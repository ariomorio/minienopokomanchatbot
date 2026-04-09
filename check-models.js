const fs = require('fs');
const path = require('path');

async function listModels() {
    try {
        // Read .env.local manually
        const envPath = path.join(__dirname, '.env.local');
        if (!fs.existsSync(envPath)) {
            console.error(".env.local file not found!");
            return;
        }

        const envContent = fs.readFileSync(envPath, 'utf8');
        const match = envContent.match(/GEMINI_API_KEY=(.+)/);

        if (!match || !match[1]) {
            console.error("GEMINI_API_KEY not found in .env.local");
            return;
        }

        const apiKey = match[1].trim();

        // Fetch models directly from API
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const response = await fetch(url);

        if (!response.ok) {
            console.error(`HTTP Error: ${response.status} ${response.statusText}`);
            const errorText = await response.text();
            console.error("Response:", errorText);
            return;
        }

        const data = await response.json();

        if (data.models) {
            console.log("--- Available Models ---");
            data.models.forEach(m => {
                // Only show gemini models
                if (m.name.includes('gemini') || m.name.includes('embedding')) {
                    console.log(`${m.name}`);
                }
            });
            console.log("------------------------");
        } else {
            console.error("Failed to list models:", data);
        }

    } catch (error) {
        console.error("Execution Error:", error);
    }
}

listModels();
