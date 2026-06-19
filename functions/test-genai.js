const { GoogleGenAI } = require('@google/genai');

async function testModel(modelName) {
    try {
        const ai = new GoogleGenAI({ vertexai: { project: 'udug-bets', location: 'us-central1' } });
        console.log(`Testing model: ${modelName}...`);
        const response = await ai.models.generateContent({
            model: modelName,
            contents: 'Hi',
        });
        console.log(`Success with ${modelName}:`, response.text);
    } catch (e) {
        console.error(`Error with ${modelName}:`, e.message);
    }
}

async function run() {
    await testModel('gemini-1.5-flash');
    await testModel('gemini-2.0-flash');
    await testModel('gemini-3.0-flash');
    await testModel('gemini-3-flash-preview');
}

run();
