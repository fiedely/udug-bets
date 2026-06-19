const { VertexAI } = require('@google-cloud/vertexai');

async function testModel(modelName) {
    try {
        const vertexAI = new VertexAI({ project: 'udug-bets', location: 'us-central1' });
        const generativeModel = vertexAI.getGenerativeModel({ model: modelName });
        console.log(`Testing model: ${modelName}...`);
        const resp = await generativeModel.generateContent('Hi');
        console.log(`Success with ${modelName}:`, resp.response.candidates[0].content.parts[0].text);
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
