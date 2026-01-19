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

### 1. Get Screens

Returns a list of all available screens.

**Endpoint:** `GET /screens`

**Authentication:** Required (if `ADMIN_PASSWORD` is set)

**Response:**
```json
[
  {
    "id": "scr_123abc_xyz",
    "name": "Screen 1"
  },
  {
    "id": "scr_456def_abc",
    "name": "Screen 2"
  }
]
```

---

### 2. Get Scenarios

Returns a list of all available scenarios.

**Endpoint:** `GET /scenarios`

**Authentication:** Required (if `ADMIN_PASSWORD` is set)

**Response:**
```json
[
  {
    "id": "clxxx1",
    "name": "Scene 1"
  },
  {
    "id": "clxxx2",
    "name": "Scene 2"
  }
]
```

---

### 3. Get Presets

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

### 4. Set Screen Content

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

### 5. Trigger Scenario

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

### 6. Trigger Preset

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
