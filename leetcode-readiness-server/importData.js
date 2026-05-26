const mongoose = require('mongoose');
require('dotenv').config(); 

const questionSchema = new mongoose.Schema({
    company: { type: String, required: true },
    title: { type: String, required: true },
    difficulty: { type: String, required: true },
    pattern: { type: String }, 
    link: { type: String }     
});

const Question = mongoose.model('Question', questionSchema);

const seedFromNetlify = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB Atlas');

        console.log('📡 Fetching data from Netlify...');
        const response = await fetch('https://extraordinary-blini-099b92.netlify.app/preloaded_data.js');
        const text = await response.text();

        // 1. Isolate the exact start and end of the JavaScript object
        let jsObjectString = text.substring(text.indexOf('{'));
        if (jsObjectString.trim().endsWith(';')) {
            jsObjectString = jsObjectString.trim().slice(0, -1);
        }
        
        // 2. THE FIX: Evaluate as native JavaScript instead of strict JSON
        const rawData = new Function(`return ${jsObjectString}`)();
        
        console.log('⚙️ Formatting questions...');
        // Map the array to our Mongoose Schema
        const formattedQuestions = rawData.problems.map(q => ({
            company: q.Company.toLowerCase(), 
            title: q.Title,
            difficulty: q.Difficulty,
            pattern: q.Topics || "General",
            link: q.Link
        }));

        await Question.deleteMany({});
        console.log('🗑️ Cleared old dummy data.');
        
        // 3. Upload in bulk
        await Question.insertMany(formattedQuestions);
        console.log(`🚀 SUCCESS! Uploaded ${formattedQuestions.length} real questions to your database!`);

        process.exit(); 
    } catch (error) {
        console.error('❌ Error during data import:', error);
        process.exit(1);
    }
};

seedFromNetlify();