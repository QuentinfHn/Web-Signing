import { PrismaClient } from "../node_modules/.prisma/client";

declare const process: { exit: (code: number) => never };

const prisma = new PrismaClient();

// Data uit de oorspronkelijke layout.json
const screens = [
    { id: "aanloopscherm1", displayId: "display1", x: 0, y: 0, width: 512, height: 512, name: "Aanloopscherm 1", lat: 50.846167887343995, lng: 5.692279202016551 },
    { id: "aanloopscherm2", displayId: "display1", x: 512, y: 0, width: 512, height: 512, name: "Aanloopscherm 2", lat: 50.84934790740343, lng: 5.6927470757633705 },
    { id: "aanloopscherm3", displayId: "display1", x: 1024, y: 0, width: 512, height: 512, name: "Aanloopscherm 3", lat: 50.84969618407943, lng: 5.704710844473488 },
    { id: "aanloopscherm4", displayId: "display1", x: 0, y: 512, width: 512, height: 512, name: "Aanloopscherm 4", lat: 50.85253624507323, lng: 5.690325323971315 },
    { id: "aanloopscherm5", displayId: "display1", x: 512, y: 512, width: 512, height: 512, name: "Aanloopscherm 5", lat: 50.84955509125214, lng: 5.686413745436391 },
    { id: "aanloopscherm6", displayId: "display1", x: 1024, y: 512, width: 512, height: 512, name: "Aanloopscherm 6", lat: 50.8470390513157, lng: 5.694961978210002 },
    { id: "aanloopscherm7", displayId: "display2", x: 416, y: 312, width: 512, height: 512, name: "Aanloopscherm 7", lat: 50.84501327711898, lng: 5.683441089795824 },
    { id: "screen1", displayId: "display2", x: 0, y: 0, width: 416, height: 104, name: "Scherm 1", lat: 50.84875661125761, lng: 5.689236564400955 },
    { id: "screen2", displayId: "display2", x: 416, y: 0, width: 416, height: 104, name: "Scherm 2", lat: 50.84876594908792, lng: 5.68934210979543 },
    { id: "screen3", displayId: "display2", x: 832, y: 0, width: 416, height: 104, name: "Scherm 3", lat: 50.8487701708642, lng: 5.689801037603975 },
    { id: "screen4", displayId: "display2", x: 1248, y: 0, width: 416, height: 104, name: "Scherm 4", lat: 50.84876847739941, lng: 5.689857363989395 },
    { id: "screen5", displayId: "display2", x: 0, y: 104, width: 416, height: 104, name: "Scherm 5", lat: 50.84888757581089, lng: 5.690416942819802 },
    { id: "screen6", displayId: "display2", x: 416, y: 104, width: 416, height: 104, name: "Scherm 6", lat: 50.84889773657286, lng: 5.690466563683148 },
    { id: "screen7", displayId: "display2", x: 832, y: 104, width: 416, height: 104, name: "Scherm 7", lat: 50.84896081792114, lng: 5.69074081954556 },
    { id: "screen8", displayId: "display2", x: 0, y: 208, width: 416, height: 104, name: "Scherm 8", lat: 50.84684727718707, lng: 5.6918542476320315 },
    { id: "screen9", displayId: "display2", x: 416, y: 208, width: 416, height: 104, name: "Scherm 9", lat: 50.847047288941404, lng: 5.69278294502667 },
    { id: "screen10", displayId: "display2", x: 832, y: 208, width: 416, height: 104, name: "Scherm 10", lat: 50.84716414218003, lng: 5.692867434604799 },
    { id: "screen11", displayId: "display2", x: 1248, y: 208, width: 416, height: 104, name: "Scherm 11", lat: 50.84630523711525, lng: 5.692204621447333 },
    { id: "EHBO", displayId: "display2", x: 0, y: 312, width: 416, height: 416, name: "EHBO", lat: 50.84920187974676, lng: 5.6879996970613 },
];

const presets = [
    { name: "Platielstraat – Scenario 1", screens: { screen1: "/content/platielstraat/scenario1/screen1.png", screen2: "/content/platielstraat/scenario1/screen2.png", screen3: "/content/platielstraat/scenario1/screen3.png", screen4: "/content/platielstraat/scenario1/screen4.png", screen5: "/content/platielstraat/scenario1/screen5.png", screen6: "/content/platielstraat/scenario1/screen6.png", screen7: "/content/platielstraat/scenario1/screen7.png" } },
    { name: "Platielstraat – Scenario 2", screens: { screen1: "/content/platielstraat/scenario2/screen1.png", screen2: "/content/platielstraat/scenario2/screen2.png", screen3: "/content/platielstraat/scenario2/screen3.png", screen4: "/content/platielstraat/scenario2/screen4.png", screen5: "/content/platielstraat/scenario2/screen5.png", screen6: "/content/platielstraat/scenario2/screen6.png", screen7: "/content/platielstraat/scenario2/screen7.png" } },
    { name: "Platielstraat – Scenario 3", screens: { screen1: "/content/platielstraat/scenario3/screen1.png", screen2: "/content/platielstraat/scenario3/screen2.png", screen3: "/content/platielstraat/scenario3/screen3.png", screen4: "/content/platielstraat/scenario3/screen4.png", screen5: "/content/platielstraat/scenario3/screen5.png", screen6: "/content/platielstraat/scenario3/screen6.png", screen7: "/content/platielstraat/scenario3/screen7.png" } },
    { name: "Platielstraat – Scenario 4", screens: { screen1: "/content/platielstraat/scenario4/screen1.png", screen2: "/content/platielstraat/scenario4/screen2.png", screen3: "/content/platielstraat/scenario4/screen3.png", screen4: "/content/platielstraat/scenario4/screen4.png", screen5: "/content/platielstraat/scenario4/screen5.png", screen6: "/content/platielstraat/scenario4/screen6.png", screen7: "/content/platielstraat/scenario4/screen7.png" } },
    { name: "Platielstraat – Test", screens: { screen1: "/content/platielstraat/test/screen1.png", screen2: "/content/platielstraat/test/screen2.png", screen3: "/content/platielstraat/test/screen3.png", screen4: "/content/platielstraat/test/screen4.png", screen5: "/content/platielstraat/test/screen5.png", screen6: "/content/platielstraat/test/screen6.png", screen7: "/content/platielstraat/test/screen7.png" } },
    { name: "Koestraat – Scenario 1", screens: { screen8: "/content/koestraat/scenario1/screen8.png", screen9: "/content/koestraat/scenario1/screen9.png", screen10: "/content/koestraat/scenario1/screen10.png", screen11: "/content/koestraat/scenario1/screen11.png" } },
    { name: "Koestraat – Scenario 2", screens: { screen8: "/content/koestraat/scenario2/screen8.png", screen9: "/content/koestraat/scenario2/screen9.png", screen10: "/content/koestraat/scenario2/screen10.png", screen11: "/content/koestraat/scenario2/screen11.png" } },
    { name: "Koestraat – Scenario 3", screens: { screen8: "/content/koestraat/scenario3/screen8.png", screen9: "/content/koestraat/scenario3/screen9.png", screen10: "/content/koestraat/scenario3/screen10.png", screen11: "/content/koestraat/scenario3/screen11.png" } },
    { name: "Koestraat – Test", screens: { screen8: "/content/koestraat/test/screen8.png", screen9: "/content/koestraat/test/screen9.png", screen10: "/content/koestraat/test/screen10.png", screen11: "/content/koestraat/test/screen11.png" } },
];

async function main() {
    console.log("Seeding database...");

    // Clear existing data
    await prisma.screenState.deleteMany();
    await prisma.preset.deleteMany();
    await prisma.screen.deleteMany();

    // Insert screens
    for (const screen of screens) {
        await prisma.screen.create({ data: screen });
    }
    console.log(`Created ${screens.length} screens`);

    // Insert presets
    for (const preset of presets) {
        await prisma.preset.create({
            data: {
                name: preset.name,
                screens: JSON.stringify(preset.screens),
            },
        });
    }
    console.log(`Created ${presets.length} presets`);

    console.log("Seeding complete!");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
