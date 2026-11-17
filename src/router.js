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

// Passes errors of async routes to the error handler instead of crashing the server
function asyncRoute(handler) {
    return (req, res, next) => handler(req, res, next).catch(next);
}

// ---------- Rendering helpers ----------

function renderConfirmation(res, { title, message, backUrl, backText }) {
    res.render('confirmation', { pageTitle: title, title, message, backUrl, backText });
}

function renderError(res, status, { message, backUrl, backText }) {
    res.status(status).render('error', { pageTitle: 'Error', message, backUrl, backText });
}

function renderNotFound(res, message = 'Producto no encontrado.') {
    renderError(res, 404, { message });
}

// The same form is used to create a new product and to edit an existing one
function renderProductForm(res, product = {}) {
    const isEdit = Boolean(product._id);

    res.render('new-product', {
        pageTitle: isEdit ? 'Editar producto' : 'Nuevo producto',
        isEdit,
        product,
        formAction: isEdit ? `/products/${product._id}/edit` : '/products/new',
        cancelUrl: isEdit ? `/products/${product._id}` : '/',
        categoryOptions: categories.map((name) => ({
            name,
            selected: name === product.category
        }))
    });
}

// ---------- Data helpers ----------

function trimmedField(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function today() {
    return new Date().toISOString().slice(0, 10);
}

async function findProduct(id) {
    return ObjectId.isValid(id) ? await products.getProduct(id) : null;
}

function findReview(product, reviewId) {
    return product?.reviews?.find((review) => review._id.toString() === reviewId) ?? null;
}

function ratingValue(rating) {
    if (typeof rating === 'string') {
        const normalized = rating.replace(/\uFE0F/g, '');
        if (/^⭐{1,5}$/.test(normalized)) return Array.from(normalized).length;
    }

    const value = Number(rating);
    return Number.isInteger(value) && value >= 1 && value <= 5 ? value : 0;
}

function starsForRating(rating) {
    return '⭐'.repeat(ratingValue(rating));
}

async function removeUpload(imagePath) {
    if (imagePath?.startsWith('/uploads/')) {
        const filename = imagePath.replace('/uploads/', '');
        await fs.rm(products.UPLOADS_FOLDER + '/' + filename, { force: true });
    }
}

// Checks the extension, the MIME type and the first bytes of the file
async function isAllowedProductImage(file) {
    const extension = extname(file.originalname).toLowerCase();
    const handle = await fs.open(file.path, 'r');

    try {
        const header = Buffer.alloc(8);
        const { bytesRead } = await handle.read(header, 0, header.length, 0);

        const isPng =
            extension === '.png' &&
            file.mimetype === 'image/png' &&
            bytesRead === 8 &&
            header.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

        const isJpeg =
            ['.jpg', '.jpeg'].includes(extension) &&
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

// ---------- Validation ----------

function readProductForm(body = {}) {
    return {
        title: trimmedField(body.title),
        text: trimmedField(body.text),
        price: trimmedField(body.price),
        category: trimmedField(body.category)
    };
}

async function validateProduct(product, currentId) {
    const errors = [];

    if (!product.title) {
        errors.push('El nombre es obligatorio.');
    } else {
        if (!/^[A-ZÁÉÍÓÚÑ]/.test(product.title)) {
            errors.push('El nombre debe empezar por mayúscula.');
        }
        if (product.title.length > 100) {
            errors.push('El nombre no puede superar los 100 caracteres.');
        }

        const sameTitle = await products.findProductByTitle(product.title);
        if (sameTitle && sameTitle._id.toString() !== currentId) {
            errors.push('Ya existe un producto con ese nombre.');
        }
    }

    if (product.text.length < 20 || product.text.length > 500) {
        errors.push('La descripción debe tener entre 20 y 500 caracteres.');
    }

    if (!categories.includes(product.category)) {
        errors.push('Selecciona una categoría válida.');
    }

    const price = Number(product.price);
    if (!/^\d+(?:\.\d{1,2})?$/.test(product.price) || price <= 0 || price > 10000) {
        errors.push('Introduce un precio entre 0,01 y 10.000 € con un máximo de dos decimales.');
    }

    return errors;
}

function readReviewForm(body = {}) {
    return {
        title: trimmedField(body.title),
        author: trimmedField(body.author),
        rating: Number(body.rating),
        text: trimmedField(body.text)
    };
}

function validateReview(review, product, currentReviewId) {
    const errors = [];

    if (!review.title) {
        errors.push('El título es obligatorio.');
    } else if (review.title.length > 80) {
        errors.push('El título no puede superar los 80 caracteres.');
    } else {
        const duplicateTitle = (product.reviews ?? []).some(
            (item) =>
                item._id.toString() !== currentReviewId &&
                typeof item.title === 'string' &&
                item.title.toLowerCase() === review.title.toLowerCase()
        );
        if (duplicateTitle) {
            errors.push('Ya existe una reseña con ese título.');
        }
    }

    if (!review.author) {
        errors.push('El autor es obligatorio.');
    } else if (review.author.length > 50) {
        errors.push('El autor no puede superar los 50 caracteres.');
    }

    if (!Number.isInteger(review.rating) || review.rating < 1 || review.rating > 5) {
        errors.push('La puntuación debe estar entre 1 y 5.');
    }

    if (review.text.length < 10 || review.text.length > 300) {
        errors.push('La reseña debe tener entre 10 y 300 caracteres.');
    }

    return errors;
}

// ---------- Shared processing for creating and editing products ----------

async function saveProduct(req, res, existing) {
    const id = existing?._id.toString();
    const product = readProductForm(req.body);
    const uploadedImage = req.file ? '/uploads/' + req.file.filename : null;

    const errors = await validateProduct(product, id);

    if (req.file) {
        if (!(await isAllowedProductImage(req.file))) {
            errors.push('La imagen debe ser un archivo PNG o JPEG válido.');
        }
    } else if (!existing) {
        errors.push('Selecciona una imagen para el producto.');
    }

    if (errors.length > 0) {
        await removeUpload(uploadedImage);
        return renderError(res, 400, {
            message: errors.join(' '),
            backUrl: existing ? `/products/${id}/edit` : '/products/new',
            backText: existing ? 'Volver a editar el producto' : 'Volver a añadir producto'
        });
    }

    product.price = Number(product.price);
    if (uploadedImage) {
        product.image = uploadedImage;
    }

    if (existing) {
        // If no new image is chosen, the previous one is kept
        await products.updateProduct(id, product);
        if (uploadedImage) {
            await removeUpload(existing.image);
        }

        return renderConfirmation(res, {
            title: 'Producto actualizado',
            message: 'Los cambios se han guardado correctamente.',
            backUrl: `/products/${id}`,
            backText: 'Ver producto'
        });
    }

    const result = await products.addProduct({ ...product, reviews: [] });

    return renderConfirmation(res, {
        title: 'Producto creado',
        message: 'El producto se ha añadido correctamente.',
        backUrl: `/products/${result.insertedId}`,
        backText: 'Ver producto'
    });
}

// ---------- Main page ----------

router.get(
    '/',
    asyncRoute(async (req, res) => {
        const search = trimmedField(req.query.search);
        const category = categories.includes(req.query.category) ? req.query.category : '';

        const result = await products.getProducts(search, category, req.query.page);

        res.render('index', {
            pageTitle: 'Inicio',
            products: result.products,
            pages: result.pages,
            hasPrev: result.currentPage > 1,
            hasNext: result.currentPage < result.totalPages,
            prevPage: result.currentPage - 1,
            nextPage: result.currentPage + 1,
            search,
            category
        });
    })
);

// ---------- Products (main entity) ----------

router.get('/products/new', (req, res) => {
    renderProductForm(res);
});

router.post(
    '/products/new',
    upload.single('image'),
    asyncRoute(async (req, res) => {
        await saveProduct(req, res, null);
    })
);

router.get(
    '/products/:id',
    asyncRoute(async (req, res) => {
        const product = await findProduct(req.params.id);
        if (!product) return renderNotFound(res);

        const productId = product._id.toString();
        product.reviews = (product.reviews ?? []).map((review) => ({
            ...review,
            productId,
            ratingStars: starsForRating(review.rating)
        }));

        res.render('detail', { pageTitle: product.title, product });
    })
);

router.get(
    '/products/:id/edit',
    asyncRoute(async (req, res) => {
        const product = await findProduct(req.params.id);
        if (!product) return renderNotFound(res);

        renderProductForm(res, product);
    })
);

router.post(
    '/products/:id/edit',
    upload.single('image'),
    asyncRoute(async (req, res) => {
        const existing = await findProduct(req.params.id);

        if (!existing) {
            await removeUpload(req.file ? '/uploads/' + req.file.filename : null);
            return renderNotFound(res);
        }

        await saveProduct(req, res, existing);
    })
);

router.post(
    '/products/:id/delete',
    asyncRoute(async (req, res) => {
        const product = ObjectId.isValid(req.params.id)
            ? await products.deleteProduct(req.params.id)
            : null;

        if (!product) return renderNotFound(res);

        await removeUpload(product.image);

        renderConfirmation(res, {
            title: 'Producto eliminado',
            message: 'El producto y sus reseñas se han eliminado correctamente.',
            backUrl: '/',
            backText: 'Volver a la página principal'
        });
    })
);

// ---------- Reviews (secondary entity) ----------

router.post(
    '/products/:id/reviews/new',
    asyncRoute(async (req, res) => {
        const product = await findProduct(req.params.id);
        if (!product) return renderNotFound(res);

        const id = product._id.toString();
        const review = readReviewForm(req.body);
        const errors = validateReview(review, product);

        if (errors.length > 0) {
            return renderError(res, 400, {
                message: errors.join(' '),
                backUrl: `/products/${id}`,
                backText: 'Volver al producto'
            });
        }

        // The date is set by the server when the review is created
        await products.addReview(id, { _id: new ObjectId(), ...review, date: today() });

        renderConfirmation(res, {
            title: 'Reseña creada',
            message: 'La reseña se ha creado correctamente.',
            backUrl: `/products/${id}`,
            backText: 'Volver al producto'
        });
    })
);

router.get(
    '/products/:id/reviews/:reviewId/edit',
    asyncRoute(async (req, res) => {
        const product = await findProduct(req.params.id);
        const review = findReview(product, req.params.reviewId);
        if (!review) return renderNotFound(res, 'Reseña no encontrada.');

        res.render('edit-review', {
            pageTitle: 'Editar reseña',
            product,
            review: { ...review, ratingStars: starsForRating(review.rating) },
            ratingOptions: [5, 4, 3, 2, 1].map((value) => ({
                value,
                selected: value === ratingValue(review.rating)
            }))
        });
    })
);

router.post(
    '/products/:id/reviews/:reviewId/edit',
    asyncRoute(async (req, res) => {
        const { id, reviewId } = req.params;
        const product = await findProduct(id);
        if (!findReview(product, reviewId)) return renderNotFound(res, 'Reseña no encontrada.');

        const review = readReviewForm(req.body);
        const errors = validateReview(review, product, reviewId);

        if (errors.length > 0) {
            return renderError(res, 400, {
                message: errors.join(' '),
                backUrl: `/products/${id}/reviews/${reviewId}/edit`,
                backText: 'Volver a editar la reseña'
            });
        }

        await products.updateReview(id, reviewId, review);

        renderConfirmation(res, {
            title: 'Reseña actualizada',
            message: 'La reseña se ha actualizado correctamente.',
            backUrl: `/products/${id}`,
            backText: 'Volver al producto'
        });
    })
);

router.post(
    '/products/:id/reviews/:reviewId/delete',
    asyncRoute(async (req, res) => {
        const { id, reviewId } = req.params;
        const product = await findProduct(id);
        if (!findReview(product, reviewId)) return renderNotFound(res, 'Reseña no encontrada.');

        await products.deleteReview(id, reviewId);

        renderConfirmation(res, {
            title: 'Reseña eliminada',
            message: 'La reseña se ha eliminado correctamente.',
            backUrl: `/products/${id}`,
            backText: 'Volver al producto'
        });
    })
);

// ---------- Error handler: shows the error page instead of crashing ----------

router.use((error, req, res, next) => {
    console.error(error);
    renderError(res, 500, { message: 'Ha ocurrido un error inesperado. Inténtalo de nuevo.' });
});