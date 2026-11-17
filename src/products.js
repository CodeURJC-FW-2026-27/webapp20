import { MongoClient, ObjectId } from 'mongodb';

const client = new MongoClient('mongodb://localhost:27017');
await client.connect();

const db = client.db('pokeurjc');
const products = db.collection('products');

export const UPLOADS_FOLDER = './uploads';

// Escapes special characters so user text can be used safely inside a regex
function escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function countProducts() {
    return await products.countDocuments();
}

export async function addProduct(product) {
    return await products.insertOne(product);
}

export async function getProduct(id) {
    return await products.findOne({ _id: ObjectId.createFromHexString(id) });
}

// Case-insensitive exact match, used to check that names are unique
export async function findProductByTitle(title) {
    return await products.findOne({
        title: { $regex: `^${escapeRegex(title)}$`, $options: 'i' }
    });
}

export async function updateProduct(id, fields) {
    return await products.updateOne({ _id: ObjectId.createFromHexString(id) }, { $set: fields });
}

// Returns the deleted product, so its image can be removed
export async function deleteProduct(id) {
    return await products.findOneAndDelete({ _id: ObjectId.createFromHexString(id) });
}

// Lists products filtered by name and category, paginated in the database
export async function getProducts(search = '', category = '', page = 1, pageSize = 6) {
    const filter = {};

    if (search) {
        filter.title = { $regex: escapeRegex(search), $options: 'i' };
    }

    if (category) {
        filter.category = category;
    }

    const totalProducts = await products.countDocuments(filter);
    const totalPages = Math.max(Math.ceil(totalProducts / pageSize), 1);
    const currentPage = Math.min(Math.max(parseInt(page) || 1, 1), totalPages);

    const productList = await products
        .find(filter)
        .sort({ _id: 1 })
        .skip((currentPage - 1) * pageSize)
        .limit(pageSize)
        .toArray();

    const pages = Array.from({ length: totalPages }, (_, i) => ({
        number: i + 1,
        isCurrent: i + 1 === currentPage
    }));

    return { products: productList, totalPages, currentPage, pages };
}

export async function addReview(productId, review) {
    return await products.updateOne(
        { _id: ObjectId.createFromHexString(productId) },
        { $push: { reviews: review } }
    );
}

export async function updateReview(productId, reviewId, review) {
    return await products.updateOne(
        { _id: ObjectId.createFromHexString(productId), 'reviews._id': ObjectId.createFromHexString(reviewId) },
        {
            $set: {
                'reviews.$.title': review.title,
                'reviews.$.author': review.author,
                'reviews.$.date': review.date,
                'reviews.$.rating': review.rating,
                'reviews.$.text': review.text
            }
        }
    );
}

export async function deleteReview(productId, reviewId) {
    return await products.updateOne(
        { _id: ObjectId.createFromHexString(productId) },
        { $pull: { reviews: { _id: ObjectId.createFromHexString(reviewId) } } }
    );
}