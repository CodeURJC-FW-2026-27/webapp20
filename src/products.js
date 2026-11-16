
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

export async function deleteProduct(id) {
    return await products.findOneAndDelete({ _id: new ObjectId(id) });
}

export async function deleteProducts() {
    return await products.deleteMany();
}

// Retrieve products with pagination
export async function getProducts(page = 1, limit = 6) {
    const totalProducts = await products.countDocuments();
    const totalPages = Math.ceil(totalProducts / limit) || 1;

    const currentPage = Math.min(
        Math.max(parseInt(page) || 1, 1),
        totalPages
    );

    const skip = (currentPage - 1) * limit;

    const productList = await products
        .find()
        .sort({ _id: 1 })
        .skip(skip)
        .limit(limit)
        .toArray();

    const pages = Array.from({ length: totalPages }, (_, i) => ({
        number: i + 1,
        isCurrent: i + 1 === currentPage
    }));

    return {
        posts: productList,
        totalPages,
        currentPage,
        pages
    };
}

export async function getProduct(id) {
    return await products.findOne({ _id: new ObjectId(id) });
}
