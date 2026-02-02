# Bitfocus Companion Integration

This document explains how to integrate the LED Controller with Bitfocus Companion using the REST API.

## Configuration

### Authentication

The API supports two authentication methods when `ADMIN_PASSWORD` is set:

1. **x-api-key header**: Send the `ADMIN_PASSWORD` value directly
2. **Authorization Bearer**: Use a JWT token (obtained from the login endpoint)

If `ADMIN_PASSWORD` is not set, the API is open (no authentication required).

### CORS Headers

The following headers must be allowed in Companion:
- `Content-Type`
- `Authorization`
- `x-api-key`

## API Endpoints

Base URL: `http://localhost:8080/api/companion`

### 1. Get Displays

Returns a list of all available displays (physical display groups).

**Endpoint:** `GET /displays`

**Authentication:** Required (if `ADMIN_PASSWORD` is set)

**Response:**
```json
[
  {
    "id": "wall-1",
    "name": "Main Wall",
    "_count": {
      "screens": 4
    }
  },
  {
    "id": "signage-1",
    "name": "Digital Signage",
    "_count": {
      "screens": 2
    }
  }
]
```

---

### 2. Get Screens

Returns a list of all available screens.

**Endpoint:** `GET /screens`

**Authentication:** Required (if `ADMIN_PASSWORD` is set)

**Response:**
```json
[
  {
    "id": "scr_123abc_xyz",
    "name": "Screen 1",
    "displayId": "wall-1"
  },
  {
    "id": "scr_456def_abc",
    "name": "Screen 2",
    "displayId": "wall-1"
  }
]
```

---

### 3. Get Scenarios

Returns a list of all available scenarios with assignment information.

**Endpoint:** `GET /scenarios`

**Authentication:** Required (if `ADMIN_PASSWORD` is set)

**Query Parameters:**
- `configured` (optional): Set to `true` to only return scenarios that have at least one screen assignment

**Response:**
```json
[
  {
    "id": "clxxx1",
    "name": "Scene 1",
    "hasAssignments": true,
    "assignedScreenIds": ["scr_123abc_xyz", "scr_456def_abc"]
  },
  {
    "id": "clxxx2",
    "name": "Scene 2",
    "hasAssignments": false,
    "assignedScreenIds": []
  }
]
```

**Example (get only configured scenarios):**
```bash
curl "http://localhost:8080/api/companion/scenarios?configured=true" \
  -H "x-api-key: YOUR_ADMIN_PASSWORD"
```

---

### 4. Turn Off Screen

Turns off a screen (sets its content to blank/null).

**Endpoint:** `POST /screens/:id/off`

**Authentication:** Required (if `ADMIN_PASSWORD` is set)

**Request Body:** Empty `{}`

**Example:**
```bash
curl -X POST http://localhost:8080/api/companion/screens/scr_123abc_xyz/off \
  -H "x-api-key: YOUR_ADMIN_PASSWORD" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Response:**
```json
{
  "success": true
}
```

---

### 5. Get Assignments

Returns all scenario assignments with content type information (still image or slideshow).

**Endpoint:** `GET /assignments`

**Authentication:** Required (if `ADMIN_PASSWORD` is set)

**Response:**
```json
[
  {
    "screenId": "scr_123abc_xyz",
    "scenario": "Scene 1",
    "contentType": "still_image",
    "imagePath": "/content/shared/logo.png",
    "intervalMs": null,
    "images": []
  },
  {
    "screenId": "scr_456def_abc",
    "scenario": "Scene 2",
    "contentType": "slideshow",
    "imagePath": "/content/promo/slide1.png",
    "intervalMs": 5000,
    "images": [
      "/content/promo/slide1.png",
      "/content/promo/slide2.png",
      "/content/promo/slide3.png"
    ]
  }
]
```

**Content Type values:**
- `still_image` - Single image (no interval or only 1 image)
- `slideshow` - Multiple images with interval

---

### 5. Get Assignments for Screen

Returns scenario assignments for a specific screen.

**Endpoint:** `GET /assignments/:screenId`

**Authentication:** Required (if `ADMIN_PASSWORD` is set)

**Response:**
```json
[
  {
    "screenId": "scr_123abc_xyz",
    "scenario": "Scene 1",
    "contentType": "still_image",
    "imagePath": "/content/shared/logo.png",
    "intervalMs": null,
    "images": []
  }
]
```

**Errors:**
- `404` - Screen not found

---

### 6. Get Presets

Returns a list of all available presets.

**Endpoint:** `GET /presets`

**Authentication:** Required (if `ADMIN_PASSWORD` is set)

**Response:**
```json
[
  {
    "id": "clxxx1",
    "name": "Morning Setup"
  },
  {
    "id": "clxxx2",
    "name": "Evening Setup"
  }
]
```

---

### 7. Set Screen Content

Sets the content for a specific screen.

**Endpoint:** `POST /screens/:id/content`

**Authentication:** Required (if `ADMIN_PASSWORD` is set)

**Request Body:**
```json
{
  "imageSrc": "/content/category/image.jpg"
}
```

**Example:**
```bash
curl -X POST http://localhost:8080/api/companion/screens/scr_123abc_xyz/content \
  -H "x-api-key: YOUR_ADMIN_PASSWORD" \
  -H "Content-Type: application/json" \
  -d '{"imageSrc": "/content/shared/welcome.jpg"}'
```

**Response:**
```json
{
  "success": true
}
```

---

### 8. Trigger Scenario

Triggers a scenario for a specific screen.

**Endpoint:** `POST /scenarios/trigger`

**Authentication:** Required (if `ADMIN_PASSWORD` is set)

**Request Body:**
```json
{
  "screenId": "scr_123abc_xyz",
  "scenarioName": "Scene 1"
}
```

**Example:**
```bash
curl -X POST http://localhost:8080/api/companion/scenarios/trigger \
  -H "x-api-key: YOUR_ADMIN_PASSWORD" \
  -H "Content-Type: application/json" \
  -d '{"screenId": "scr_123abc_xyz", "scenarioName": "Scene 1"}'
```

**Response:**
```json
{
  "success": true
}
```

---

### 9. Trigger Preset

Activates a preset (updates all screens defined in the preset).

**Endpoint:** `POST /presets/trigger`

**Authentication:** Required (if `ADMIN_PASSWORD` is set)

**Request Body:**
```json
{
  "presetId": "clxxx1"
}
```

**Example:**
```bash
curl -X POST http://localhost:8080/api/companion/presets/trigger \
  -H "x-api-key: YOUR_ADMIN_PASSWORD" \
  -H "Content-Type: application/json" \
  -d '{"presetId": "clxxx1"}'
```

**Response:**
```json
{
  "success": true}
```

### 10. Get VNNOX Player Status (All Screens)

Returns the online/offline status of all screens that have a VNNOX player linked. Status is polled from VNNOX every 15 seconds and cached in the database.

**Endpoint:** `GET /vnnox/status`

**Authentication:** Required (if `ADMIN_PASSWORD` is set)

**Response (VNNOX enabled):**
```json
{
  "enabled": true,
  "screens": [
    {
      "screenId": "scr_123abc_xyz",
      "screenName": "Screen 1",
      "displayId": "wall-1",
      "playerId": "8208967d40e9980bab6d12367dc88e0b",
      "playerName": "Player Lobby",
      "online": true,
      "lastSeen": "2025-01-15T14:30:00.000Z"
    },
    {
      "screenId": "scr_456def_abc",
      "screenName": "Screen 2",
      "displayId": "wall-1",
      "playerId": "a3b4c5d6e7f8901234567890abcdef12",
      "playerName": "Player Entrance",
      "online": false,
      "lastSeen": "2025-01-15T12:00:00.000Z"
    }
  ]
}
```

**Response (VNNOX not configured):**
```json
{
  "enabled": false,
  "screens": []
}
```

**Example:**
```bash
curl http://localhost:8080/api/companion/vnnox/status \
  -H "x-api-key: YOUR_ADMIN_PASSWORD"
```

---

### 11. Get VNNOX Player Status (Single Screen)

Returns the VNNOX player status for a specific screen.

**Endpoint:** `GET /vnnox/status/:screenId`

**Authentication:** Required (if `ADMIN_PASSWORD` is set)

**Response (screen linked to player):**
```json
{
  "enabled": true,
  "screen": {
    "screenId": "scr_123abc_xyz",
    "screenName": "Screen 1",
    "displayId": "wall-1",
    "linked": true,
    "playerId": "8208967d40e9980bab6d12367dc88e0b",
    "playerName": "Player Lobby",
    "online": true,
    "lastSeen": "2025-01-15T14:30:00.000Z"
  }
}
```

**Response (screen not linked to any player):**
```json
{
  "enabled": true,
  "screen": {
    "screenId": "scr_123abc_xyz",
    "screenName": "Screen 1",
    "displayId": "wall-1",
    "linked": false,
    "playerId": null,
    "playerName": null,
    "online": null,
    "lastSeen": null
  }
}
```

**Errors:**
- `404` - Screen not found

**Example:**
```bash
curl http://localhost:8080/api/companion/vnnox/status/scr_123abc_xyz \
  -H "x-api-key: YOUR_ADMIN_PASSWORD"
```

---

## Bitfocus Companion Setup

### Using the Generic HTTP Module

1. **Add a new Generic HTTP module** in Companion
2. **Configure connection:**
   - URL: `http://localhost:8080/api/companion`
   - Add `x-api-key` header with your `ADMIN_PASSWORD` (if set)
3. **Create buttons:**

#### Example: Set Screen Content

- **Method:** POST
- **URL:** `screens/SCREEN_ID/content`
- **Headers:** `Content-Type: application/json`
- **Body:**
  ```json
  {
    "imageSrc": "/content/shared/welcome.jpg"
  }
  ```

#### Example: Trigger Scenario

- **Method:** POST
- **URL:** `scenarios/trigger`
- **Headers:** `Content-Type: application/json`
- **Body:**
  ```json
  {
    "screenId": "scr_123abc_xyz",
    "scenarioName": "Scene 1"
  }
  ```

#### Example: Trigger Preset

- **Method:** POST
- **URL:** `presets/trigger`
- **Headers:** `Content-Type: application/json`
- **Body:**
  ```json
  {
    "presetId": "clxxx1"
  }
  ```

## Image Paths

Images must be uploaded via the main application first. Use the `/api/upload` endpoint (requires authentication) to upload images.

Common image paths:
- `/content/shared/yourimage.jpg`
- `/content/category/yourimage.jpg`

## WebSocket Updates

When the REST API updates screen content (via setting screen content, triggering scenarios, or presets), all connected WebSocket clients are automatically notified of the state change. This ensures the frontend updates in real-time.

## Testing

You can test the API endpoints using curl or Postman:

```bash
# Get screens
curl http://localhost:8080/api/companion/screens

# Set screen content (with auth)
curl -X POST http://localhost:8080/api/companion/screens/SCREEN_ID/content \
  -H "x-api-key: YOUR_PASSWORD" \
  -H "Content-Type: application/json" \
  -d '{"imageSrc": "/content/shared/test.jpg"}'
```

## Error Responses

### 401 Unauthorized
Authentication is required but not provided or invalid.

**Response:**
```json
{
  "error": "Unauthorized"
}
```

### 400 Bad Request
Invalid request parameters.

**Response:**
```json
{
  "error": "imageSrc is required"
}
```

### 404 Not Found
Resource not found (e.g., screen ID doesn't exist).

**Response:**
```json
{
  "error": "Screen not found"
}
```

### 500 Internal Server Error
Server error occurred.

**Response:**
```json
{
  "error": "Failed to fetch screens"
}
```
