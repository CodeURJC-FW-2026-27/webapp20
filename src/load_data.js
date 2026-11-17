import fs from 'node:fs/promises';
import { ObjectId } from 'mongodb';
import * as products from './products.js';


const UPLOADS_FOLDER = './uploads';
const DATA_FOLDER = './data';
const IMAGES_FOLDER = './public/images/products';

let dataFile = 'data.json';

const dataString = await fs.readFile(DATA_FOLDER + '/' + dataFile, 'utf8');

const productsList = JSON.parse(dataString);

await fs.mkdir(UPLOADS_FOLDER, { recursive: true });

if (await products.countProducts() === 0) {
    for (const product of productsList) {
        if (!Array.isArray(product.reviews)) {
            product.reviews = [];
        }

        product.reviews = product.reviews.map(review => ({
            _id: new ObjectId(),
            author: review.author,
            text: review.text,
            rating: review.rating,
            date: review.date || new Date().toISOString().slice(0, 10)
        }));

        await products.addProduct(product);
    }
    console.log('Demo data loaded');
} else {
    console.log('Existing products preserved');
}
