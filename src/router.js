
import express from 'express';
import multer from 'multer';
import fs from 'node:fs/promises';

import * as products from './products.js';

const router = express.Router();
export default router;

const upload = multer({ dest: products.UPLOADS_FOLDER });


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

// Product details
router.get('/products/:id', async (req, res) => {
    const product = await products.getProduct(req.params.id);

    if (!product) {
        return res.status(404).send('Producto no encontrado');
    }

    res.render('detail', { product });
});

// Delete product
router.get('/products/:id/delete', async (req, res) => {
    const product = await products.deleteProduct(req.params.id);

    if (product && product.image) {
        await fs.rm(
            products.UPLOADS_FOLDER + '/' + product.image.split('/').pop(),
            { force: true }
        );
    }

    res.render('deleted_product');
});

// Download product image
router.get('/products/:id/image', async (req, res) => {
    const product = await products.getProduct(req.params.id);

    if (!product || !product.image) {
        return res.status(404).send('Imagen no encontrada');
    }

    res.download(
        products.UPLOADS_FOLDER + '/' + product.image.split('/').pop()
    );
});

// Edit product page
router.get('/products/:id/edit', async (req, res) => {
    const product = await products.getProduct(req.params.id);

    if (!product) {
        return res.status(404).send('Producto no encontrado');
    }

    res.render('edit-product', { product });
});
