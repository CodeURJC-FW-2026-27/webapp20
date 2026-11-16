import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';

const router = express.Router();
export default router;

const client = new MongoClient('mongodb://localhost:27017');

await client.connect();

const db = client.db('pokeurjc');
const products = db.collection('products');

export const UPLOADS_FOLDER = './uploads';

export async function addProduct(product) {

    return await products.insertOne(product);
}

export async function deleteProduct(id){

    return await products.findOneAndDelete({ _id: new ObjectId(id) });
}

export async function deleteProducts(){

    return await products.deleteMany();
}

export async function getProducts(){

    return await products.find().toArray();
}

export async function getProduct(id){

    return await products.findOne({ _id: new ObjectId(id) });
}

