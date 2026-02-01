import { prisma } from "../prisma/client.js";
import { logger } from "../utils/logger.js";

/**
 * Initialize default data if the database is empty.
 * Creates a default display and 512x512 screen for fresh deployments.
 */
export async function initDefaultData(): Promise<void> {
    try {
        // Check if any displays exist
        const displayCount = await prisma.display.count();

        if (displayCount === 0) {
            logger.info("🔧 No displays found, creating default configuration...");

            // Create default display
            await prisma.display.create({
                data: {
                    id: "main",
                    name: "Main Display",
                },
            });
            logger.info("✅ Created default display: main");

            // Create default 512x512 screen
            await prisma.screen.create({
                data: {
                    id: "default-screen",
                    displayId: "main",
                    name: "Default Screen",
                    x: 0,
                    y: 0,
                    width: 512,
                    height: 512,
                },
            });
            logger.info("✅ Created default screen: 512x512");

            // Also seed default scenarios if they don't exist
            const scenarioCount = await prisma.scenario.count();
            if (scenarioCount === 0) {
                const defaults = ["Scene 1", "Scene 2", "Scene 3"];
                for (let i = 0; i < defaults.length; i++) {
                    await prisma.scenario.create({
                        data: { name: defaults[i], displayOrder: i },
                    });
                }
                logger.info("✅ Created default scenarios");
            }

            logger.info("🎉 Default configuration complete!");
        } else {
            logger.info(`📊 Found ${displayCount} existing display(s), skipping initialization`);
        }
    } catch (error) {
        logger.error("Failed to initialize default data:", error);
        // Don't throw - let the server start anyway
    }
}
