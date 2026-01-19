/**
 * Migration script to fix broken content paths.
 * 
 * Problem: Files were uploaded to /content/shared because Multer received the
 * file before the category field. The database recorded the correct path (e.g.,
 * /content/Algemeen/filename.png), but the file is actually in /content/shared.
 * 
 * Solution: Move files from /content/shared to their correct category folder.
 * 
 * Run with: npx dotenv -e ../.env -- tsx scripts/fix-content-paths.ts
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function main() {
    console.log("🔍 Checking for misplaced content files...\n");

    const contentDir = path.join(__dirname, "../../content");
    const sharedDir = path.join(contentDir, "shared");

    // Get all content records from the database
    const contents = await prisma.content.findMany();

    let fixed = 0;
    let alreadyOk = 0;
    let errors = 0;

    for (const content of contents) {
        // Expected path based on database
        const expectedPath = path.join(__dirname, "../..", content.path);

        // Check if file exists at expected location
        try {
            await fs.access(expectedPath);
            alreadyOk++;
            continue; // File is in the right place
        } catch {
            // File not found at expected location
        }

        // Try to find the file in /content/shared
        const filename = path.basename(content.path);
        const sharedPath = path.join(sharedDir, filename);

        try {
            await fs.access(sharedPath);

            // File found in shared! Move it to the correct location.
            const targetDir = path.dirname(expectedPath);

            // Create target directory if needed
            await fs.mkdir(targetDir, { recursive: true });

            // Move the file
            await fs.rename(sharedPath, expectedPath);

            console.log(`✅ Moved: ${filename}`);
            console.log(`   From: ${sharedPath}`);
            console.log(`   To:   ${expectedPath}\n`);
            fixed++;
        } catch {
            console.log(`❌ Could not find: ${filename}`);
            console.log(`   Expected: ${expectedPath}`);
            console.log(`   Checked:  ${sharedPath}\n`);
            errors++;
        }
    }

    console.log("═".repeat(50));
    console.log(`📊 Summary:`);
    console.log(`   ✅ Already correct: ${alreadyOk}`);
    console.log(`   🔧 Fixed: ${fixed}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log("═".repeat(50));

    await prisma.$disconnect();
}

main().catch((e) => {
    console.error("Fatal error:", e);
    process.exit(1);
});
