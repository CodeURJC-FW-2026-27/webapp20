import fs from 'node:fs/promises';
import * as products from './products.js';


const UPLOADS_FOLDER = './uploads';
const DATA_FOLDER = './data';
const IMAGES_FOLDER = './public/images/products';

let dataFile = 'data.json';

const dataString = await fs.readFile(DATA_FOLDER + '/' + dataFile, 'utf8');

const productsList = JSON.parse(dataString);

await products.deleteProducts();
for(let product of productsList){
    await products.addProduct(product);
}

await fs.rm(UPLOADS_FOLDER, { recursive: true, force: true });
await fs.mkdir(UPLOADS_FOLDER);

console.log('Demo data loaded');

