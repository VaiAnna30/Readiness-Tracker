const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config(); 

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// 1. Define the Mongoose Schema & Model
const questionSchema = new mongoose.Schema({
    company: { type: String, required: true },
    title: { type: String, required: true },
    difficulty: { type: String, required: true },
    pattern: { type: String }, 
    link: { type: String }     
});

const Question = mongoose.model('Question', questionSchema);

// 2. Connect to MongoDB Atlas
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ Connected to MongoDB Atlas'))
    .catch((err) => console.error('❌ MongoDB connection error:', err));

// --- NEW ROUTE: Fetch all unique companies ---
app.get('/api/companies', async (req, res) => {
    try {
        // .distinct() gets all unique values for a specific field
        const companies = await Question.distinct('company');
        
        // Filter out any null/empty strings and sort alphabetically
        const cleanCompanies = companies.filter(c => c).sort();
        
        res.json({ success: true, companies: cleanCompanies });
    } catch (error) {
        console.error("Error fetching companies:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// 3. API Route to fetch 5 random questions directly from MongoDB
app.get('/api/questions/:company', async (req, res) => {
    const companyName = req.params.company.toLowerCase();
    
    try {
        // Use MongoDB aggregation to match the company and grab 5 random problems
        const questions = await Question.aggregate([
            { $match: { company: companyName } },
            { $sample: { size: 5 } } 
        ]);
        
        if (questions.length > 0) {
            res.json({ success: true, questions: questions });
        } else {
            res.status(404).json({ success: false, message: "No questions found for this company" });
        }
    } catch (error) {
        console.error("Database query error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// 4. Start the server
app.listen(PORT, () => {
    console.log(`✅ Backend Server is running on http://localhost:${PORT}`);
});