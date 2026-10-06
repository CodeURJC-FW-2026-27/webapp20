# PokeURJC
### webapp20

> *A web application for browsing and selling Pokémon products.*
--------------------------------------------------------------------------
## Members

| Name and Surnames | University Mail | Github Username |
|-----------|-----------|-----------|
| Ignacio Roncero Medina   | i.roncero.2024@alumnos.urjc.es   | NachoRonc   |
| Rim Afoud  |  r.afoud.2024@alumnos.urjc.es | rimafd  |
| Sergio Alejandro Romero    | sa.romero.2024@alumnos.urjc.es    | sergioromero2k   |
| Alvaro Martin Jurado  |  a.martinju.2026@alumnos.urjc.es | AlvaritoMartin87  |

---

## Coordination Tools

None in use for now.

---

## Project Description
**PokeURJC** is a web application focused on **browsing and selling Pokémon products.**

The application allows users to **explore a collection of Pokémon related products** and access detailed information about each product, such as its **name, price, description, Pokémon and product type.**
Users can also **add new Pokémon products** to the application. Each product can have an associated **image** and **reviews from users.**
The main objective of **PokeURJC** is to provide a **simple and intuitive platform** where users can **discover, view and sell Pokémon products.**

## Functionality

### Main Entity: Pokémon Product

Each product will contain the following information:

- Name
- Price
- Description
- Pokémon
- Product Type
- Image

### Secondary Entity: Review

- Author
- Rating
- Date

> Only the main/primary entity will be able to have uploaded images.

### Images
Only the main entity (**Pokémon Product**) will have an associated image.

### Search, Filtering and Categorization
* **Search**: users can search products by **name**.
* **Categorization**: products are grouped by **product type** (``Cards``, ``Plushies``, ``Figures``, ``Clothing``, ``Accessories``), shown as buttons in the menu to browse each category.

---

## Development Conventions
* **Commits** follow the Conventional Commits specification, e.g. ``feat(header): add navbar with product categories.``
* **Code, comments and file names** are written in English. Only texts shown to the user are in Spanish.
* **File names** use lowercase and hyphens, without spaces or accents (e.g. ``charizard-ex-card.jpg``).
* **Formatting** is done automatically with Prettier (*Format On Save*).
