import fs from 'node:fs/promises';
import { basename, join } from 'node:path';
import { ObjectId } from 'mongodb';
import * as products from './products.js';

const DATA_FOLDER = './data';
const DATA_FILE = './data/data.json';

// The uploads folder must exist before any image is uploaded
await fs.mkdir(products.UPLOADS_FOLDER, { recursive: true });

const sampleProducts = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
const imageNames = sampleProducts.map((product) => basename(product.image));

for (const imageName of imageNames) {
    await fs.copyFile(
        join(DATA_FOLDER, imageName),
        join(products.UPLOADS_FOLDER, imageName)
    );
    await products.updateProductImagePath(
        `/images/products/${imageName}`,
        `/uploads/${imageName}`
    );
}

// Sample data is only inserted when the database is empty
if ((await products.countProducts()) === 0) {
    for (const product of sampleProducts) {
        product.image = `/uploads/${basename(product.image)}`;
        product.reviews = (product.reviews ?? []).map((review) => ({
            _id: new ObjectId(),
            title: review.title,
            author: review.author,
            text: review.text,
            rating: Number(review.rating),
            date: review.date || new Date().toISOString().slice(0, 10)
        }));

        await products.addProduct(product);
    }

    console.log('Demo data loaded');
} else {
    console.log('Existing products preserved');
}