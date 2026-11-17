import express from 'express';
import multer from 'multer';
import fs from 'node:fs/promises';
import { ObjectId } from 'mongodb';

import * as products from './products.js';

const router = express.Router();
export default router;

const upload = multer({ dest: products.UPLOADS_FOLDER });
const categories = ['Cartas', 'Peluches', 'Figuras', 'Ropa', 'Accesorios'];

router.get('/', async (req, res) => {
    try {
        const search = req.query.search || '';
        const category = req.query.category || '';
        const page = parseInt(req.query.page) || 1;
        const limit = 6;

        const result = await products.filterProducts(
            search,
            category,
            page,
            limit
        );

        const prevPage = result.currentPage - 1;
        const nextPage = result.currentPage + 1;

        res.render('index', {
            posts: result.posts,
            pages: result.pages,
            currentPage: result.currentPage,
            totalPages: result.totalPages,
            hasPrev: result.currentPage > 1,
            hasNext: result.currentPage < result.totalPages,
            prevPage,
            nextPage,
            search,
            category
        });

    } catch (error) {
        console.error('Error loading products:', error);
        res.status(500).send('Error loading products');
    }
});


// New product
router.get('/new-product.html', (req, res) => {
    res.render('new-product');
});

// Create new product
router.post('/products/new', upload.single('image'), async (req, res) => {
    const product = {
        user: req.body.user,
        title: req.body.title,
        text: req.body.text,
        price: req.body.price,
        category: req.body.category,
        image: req.file ? '/uploads/' + req.file.filename : undefined
    };

    const result = await products.addProduct(product);

    res.render('saved_product', {
        _id: result.insertedId.toString()
    });
});


function validateProduct(product) {
    const errors = [];

    if (!product.title.trim()) errors.push('El título es obligatorio.');
    if (!product.text.trim()) errors.push('La descripción es obligatoria.');
    if (!categories.includes(product.category)) {
        errors.push('Selecciona una categoría válida.');
    }
    if (
        product.price === '' ||
        !Number.isFinite(Number(product.price)) ||
        Number(product.price) < 0
    ) {
        errors.push('Introduce un precio válido.');
    }

    return errors;
}

function validateReview(review) {
    const errors = [];

    if (!review.title) errors.push('El título es obligatorio.');
    if (!review.author) errors.push('El autor es obligatorio.');

    const date = new Date(`${review.date}T00:00:00.000Z`);
    if (
        !/^\d{4}-\d{2}-\d{2}$/.test(review.date) ||
        Number.isNaN(date.getTime()) ||
        date.toISOString().slice(0, 10) !== review.date
    ) {
        errors.push('Introduce una fecha válida.');
    }

    if (!Number.isInteger(review.rating) ||
        review.rating < 1 ||
        review.rating > 5) {
        errors.push('La puntuación debe estar entre 1 y 5.');
    }
    if (review.text.length < 10 || review.text.length > 300) {
        errors.push('La reseña debe tener entre 10 y 300 caracteres.');
    }

    return errors;
}


router.get('/products/:id', async (req, res) => {
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
        return res.status(404).render('deleted_product');
    }

    const product = await products.getProduct(id);

    if (!product) {
        return res.status(404).render('deleted_product');
    }

    product.reviews = (product.reviews || []).map(review => ({
        ...review,
        productId: id
    }));

    res.render('detail', { product });
});


// Delete product
router.post('/products/:id/delete', async (req, res) => {
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
        return res.status(404).render('deleted_product');
    }

    const product = await products.deleteProduct(id);

    if (!product) {
        return res.status(404).render('deleted_product');
    }

   if (product.image && product.image.startsWith('/uploads/')) {
    const filename = product.image.replace('/uploads/', '');
    await fs.rm(products.UPLOADS_FOLDER + '/' + filename, { force: true });
}

    res.render('deleted_product');
});




