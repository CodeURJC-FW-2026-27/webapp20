import express from 'express';
import multer from 'multer';
import fs from 'node:fs/promises';

import * as products from './products.js';

const router = express.Router();
export default router;

const upload = multer({ dest: products.UPLOADS_FOLDER })

//Homepage
router.get('/', async (req, res) => {

    let posts = await products.getProducts();

    res.render('index', { posts });
});

// New product 
router.get('/new-product.html', (req, res) => {
    
    res.render('new-product');
});



router.post('/products/new', upload.single('image'), async (req, res) => {

    let product = {
        user: req.body.user,
        title: req.body.title,
        text: req.body.text,
        price: req.body.price,
        category: req.body.category,
        image: req.file ? '/uploads/' + req.file.filename : undefined
    };

    await products.addProduct(product);

    res.render('saved_product', { _id: product._id.toString() });

});

router.get('/products/:id', async (req, res) => {

    let product = await products.getProduct(req.params.id);

    res.render('detail', { product });
});

router.get('/products/:id/delete', async (req, res) => {

    let product = await products.deleteProduct(req.params.id);

    if (product && product.imageFilename) {
        await fs.rm(products.UPLOADS_FOLDER + '/' + product.imageFilename);
    }

    res.render('deleted_product');
});

router.get('/products/:id/image', async (req, res) => {

    let product = await products.getProduct(req.params.id);

    res.download(products.UPLOADS_FOLDER + '/' + product.imageFilename);

});

// Edit product page
router.get('/products/:id/edit', async (req, res) => {

    let product = await products.getProduct(req.params.id);

    if (!product) {
        return res.status(404).send('Producto no encontrado');
    }

    res.render('edit-product', { product });
});
