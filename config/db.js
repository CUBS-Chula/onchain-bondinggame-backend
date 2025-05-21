const mongoose = require('mongoose');

const connectDB = async()=>{
    mongoose.set('strictQuery',true);
    const conn = await mongoose.connect("mongodb+srv://satangpattanun:satangpattanun@cluster0.gxqvsyg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0");

    console.log(`MongoDB Connected: ${conn.connection.host}`);
}

module.exports =connectDB;