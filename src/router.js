import express from 'express';
import multer from 'multer';
import fs from 'node:fs/promises';
import { extname } from 'node:path';
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
    const body = req.body || {};
    const product = {
        title: trimmedField(body.title),
        text: trimmedField(body.text),
        price: trimmedField(body.price),
        category: trimmedField(body.category),
        image: req.file ? '/uploads/' + req.file.filename : undefined
    };

    const errors = validateProduct(product);
    if (!req.file) {
        errors.push('Selecciona una imagen para el producto.');
    } else if (!(await isAllowedProductImage(req.file))) {
        errors.push('La imagen debe ser un archivo PNG o JPEG válido.');
    }

    if (errors.length > 0) {
        if (req.file) {
            await fs.rm(products.UPLOADS_FOLDER + '/' + req.file.filename,
                { force: true }
            );
        }
        return res.status(400).render('error', {
            message: errors.join(' '),
            backUrl: '/new-product.html',
            backText: 'Volver a añadir producto'
        });
    }

    product.price = Number(product.price);

    try {
        const result = await products.addProduct(product);
        return res.render('confirmation', {
            title: 'Producto creado',
            message: 'El producto se ha añadido correctamente.',
            backUrl: `/products/${result.insertedId}`,
            backText: 'Ver producto'
        });
    } catch (error) {
        console.error('Error creating product:', error);
        if (req.file) {
            await fs.rm(products.UPLOADS_FOLDER + '/' + req.file.filename,
                { force: true }
            );
        }
        return res.status(500).render('error', {
            message: 'No se pudo guardar el producto. Inténtalo de nuevo.'
        });
    }
});


function validateProduct(product) {
    const errors = [];

    if (!product.title) errors.push('El título es obligatorio.');
    if (product.title.length > 100) {
        errors.push('El título no puede superar los 100 caracteres.');
    }
    if (!product.text) errors.push('La descripción es obligatoria.');
    if (!categories.includes(product.category)) {
        errors.push('Selecciona una categoría válida.');
    }
    if (
        !/^\d+(?:\.\d{1,2})?$/.test(product.price) ||
        !Number.isFinite(Number(product.price)) ||
        Number(product.price) < 0
    ) {
        errors.push('Introduce un precio válido con un máximo de dos decimales.');
    }

    return errors;
}

function trimmedField(value) {
    return typeof value === 'string' ? value.trim() : '';
}

async function isAllowedProductImage(file) {
    const extension = extname(file.originalname).toLowerCase();
    const handle = await fs.open(file.path, 'r');

    try {
        const header = Buffer.alloc(8);
        const { bytesRead } = await handle.read(header, 0, header.length, 0);
        const isPng = extension === '.png' &&
            file.mimetype === 'image/png' &&
            bytesRead === 8 &&
            header.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
        const isJpeg = ['.jpg', '.jpeg'].includes(extension) &&
            file.mimetype === 'image/jpeg' &&
            bytesRead >= 3 &&
            header[0] === 0xff &&
            header[1] === 0xd8 &&
            header[2] === 0xff;

        return isPng || isJpeg;
    } finally {
        await handle.close();
    }
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



router.get('/products/:id/edit', async (req, res) => {
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
        return res.status(404).render('deleted_product');
    }

    const product = await products.getProduct(id);

    if (!product) {
        return res.status(404).render('deleted_product');
    }

    product.isCartas = product.category === 'Cartas';
    product.isPeluches = product.category === 'Peluches';
    product.isFiguras = product.category === 'Figuras';
    product.isRopa = product.category === 'Ropa';
    product.isAccesorios = product.category === 'Accesorios';
    product.priceInput = String(product.price);

    res.render('edit-product', { product });
});


router.post('/products/:id/edit', upload.single('image'), async (req, res) => {
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
        return res.status(404).render('deleted_product');
    }

    const existing = await products.getProduct(id);

    if (!existing) {
        return res.status(404).render('deleted_product');
    }

    const updatedFields = {
        title: (req.body.title || '').trim(),
        text: (req.body.text || '').trim(),
        price: (req.body.price || '').trim(),
        category: (req.body.category || '').trim()
    };

    const errors = validateProduct(updatedFields);

    if (errors.length > 0) {
        if (req.file) {await fs.rm(products.UPLOADS_FOLDER + '/' + req.file.filename,
            { force: true }
    );
}
        return res.status(400).render('error', {
            message: errors.join(' '),
            backUrl: `/products/${id}/edit`,
            backText: 'Volver a editar el producto'
        });
    }

    updatedFields.price = Number(updatedFields.price);

    if (req.file) {
        updatedFields.image = `/uploads/${req.file.filename}`;
    }

    await products.updateProduct(id, updatedFields);

    if (req.file && existing.image && existing.image.startsWith('/uploads/')) {
    const oldFilename = existing.image.replace('/uploads/', '');
    await fs.rm(products.UPLOADS_FOLDER + '/' + oldFilename, { force: true });
}

    res.render('updated_product', { productId: id });
});



router.post('/products/:id/reviews/new', async (req, res) => {
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
        return res.status(404).render('error', {
            message: 'Producto no encontrado.'
        });
    }

    const product = await products.getProduct(id);

    if (!product) {
        return res.status(404).render('error', {
            message: 'Producto no encontrado.'
        });
    }

    const review = {
        title: (req.body.title || '').trim(),
        author: (req.body.author || '').trim(),
        date: (req.body.date || '').trim(),
        rating: Number(req.body.rating),
        text: (req.body.text || '').trim()
    };

    const errors = validateReview(review);
    const duplicateTitle = (product.reviews || []).some(item =>
        typeof item.title === 'string' &&
        item.title.toLowerCase() === review.title.toLowerCase()
    );

    if (duplicateTitle) {
        errors.push('Ya existe una reseña con ese título.');
    }

    if (errors.length > 0) {
        return res.status(400).render('error', {
            message: errors.join(' '),
            backUrl: `/products/${id}`,
            backText: 'Volver al producto'
        });
    }

    await products.addReview(id, {
        _id: new ObjectId(),
        ...review
    });

    res.render('confirmation', {
        title: 'Reseña creada',
        message: 'La reseña se ha creado correctamente.',
        backUrl: `/products/${id}`,
        backText: 'Volver al producto'
    });
});


router.get('/products/:id/reviews/:reviewId/edit', async (req, res) => {
    const { id, reviewId } = req.params;

    if (!ObjectId.isValid(id) || !ObjectId.isValid(reviewId)) {
        return res.status(404).render('error', {
            message: 'Reseña no encontrada.'
        });
    }

    const product = await products.getProduct(id);
    const review = product?.reviews?.find(
        item => item._id.toString() === reviewId
    );

    if (!product || !review) {
        return res.status(404).render('error', {
            message: 'Reseña no encontrada.'
        });
    }

    res.render('edit-review', { product, review });
});


router.post('/products/:id/reviews/:reviewId/edit', async (req, res) => {
        const { id, reviewId } = req.params;

        if (!ObjectId.isValid(id) || !ObjectId.isValid(reviewId)) {
            return res.status(404).render('error', {
                message: 'Reseña no encontrada.'
            });
        }

        const product = await products.getProduct(id);
        const existingReview = product?.reviews?.find(
            item => item._id.toString() === reviewId
        );

        if (!product || !existingReview) {
            return res.status(404).render('error', {
                message: 'Reseña no encontrada.'
            });
        }

        const updatedReview = {
            title: (req.body.title || '').trim(),
            author: (req.body.author || '').trim(),
            date: (req.body.date || '').trim(),
            rating: Number(req.body.rating),
            text: (req.body.text || '').trim()
        };

        const errors = validateReview(updatedReview);
        const duplicateTitle = (product.reviews || []).some(item =>
            item._id.toString() !== reviewId &&
            typeof item.title === 'string' &&
            item.title.toLowerCase() === updatedReview.title.toLowerCase()
        );

        if (duplicateTitle) {
            errors.push('Ya existe una reseña con ese título.');
        }

        if (errors.length > 0) {
            return res.status(400).render('error', {
                message: errors.join(' '),
                backUrl: `/products/${id}/reviews/${reviewId}/edit`,
                backText: 'Volver a editar la reseña'
            });
        }

        await products.updateReview(id, reviewId, updatedReview);

        res.render('confirmation', {
            title: 'Reseña actualizada',
            message: 'La reseña se ha actualizado correctamente.',
            backUrl: `/products/${id}`,
            backText: 'Volver al producto'
        });
    }
);

router.post(
    '/products/:id/reviews/:reviewId/delete',
    async (req, res) => {
        const { id, reviewId } = req.params;

        if (!ObjectId.isValid(id) || !ObjectId.isValid(reviewId)) {
            return res.status(404).render('error', {
                message: 'Reseña no encontrada.'
            });
        }

        const product = await products.getProduct(id);
        const review = product?.reviews?.find(
            item => item._id.toString() === reviewId
        );

        if (!product || !review) {
            return res.status(404).render('error', {
                message: 'Reseña no encontrada.'
            });
        }

        await products.deleteReview(id, reviewId);

        res.render('confirmation', {
            title: 'Reseña eliminada',
            message: 'La reseña se ha eliminado correctamente.',
            backUrl: `/products/${id}`,
            backText: 'Volver al producto'
        });
    }
);