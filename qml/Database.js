/*
 * Copyright (C) 2015 Markus Mayr <markus.mayr@outlook.com>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; version 2 only.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301, USA.
 */

.pragma library
.import QtQuick.LocalStorage 2.0 as DB

var databaseHandler = null;
var shops = null;
var shopTypes = null;
var categories = null;

function openDatabase() {
    if (databaseHandler === null)
    {
        databaseHandler = DB.LocalStorage.openDatabaseSync(
                            "harbour-budgetbook", "0.1",
                            "Your expenses.", 1000000);

        //clearDatabase();
        initializeDatabase(false);
    }
    return databaseHandler;
}

function clearDatabase()
{
    var db = openDatabase();
    db.transaction(function(tx) {
        tx.executeSql("DROP TABLE IF EXISTS categories");
        tx.executeSql("DROP TABLE IF EXISTS tags");
        tx.executeSql("DROP TABLE IF EXISTS shop_types");
        tx.executeSql("DROP TABLE IF EXISTS shops");
        tx.executeSql("DROP TABLE IF EXISTS invoices");
        tx.executeSql("DROP TABLE IF EXISTS invoice_items");
        tx.executeSql("DROP TABLE IF EXISTS invoice_item_tags");
    });

    initializeDatabase();
}

function initializeDatabase(withDemoData)
{
    var db = openDatabase();
    db.transaction(function(tx) {
        /*
         * Set up categories & items.
         */
        tx.executeSql("\
            CREATE TABLE IF NOT EXISTS categories ( \
                id INTEGER PRIMARY KEY AUTOINCREMENT, \
                name TEXT UNIQUE NOT NULL
            )");

        var otherCategoryId = -1;
        if (getCategories().length === 0) {
            otherCategoryId = tx.executeSql("INSERT INTO categories (name) VALUES (?)", qsTr("Other")).insertId;
            categories = null;
        }

        tx.executeSql("\
            CREATE TABLE IF NOT EXISTS tags ( \
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL
            )");

        /*
         * Set up shop types and default values.
         */
        tx.executeSql("\
            CREATE TABLE IF NOT EXISTS shop_types ( \
                id INTEGER PRIMARY KEY AUTOINCREMENT, \
                name TEXT UNIQUE NOT NULL \
            )");

        var otherShopTypeId = -1;
        if (getShopTypes().length === 0) {
            var types = [qsTr("Super Market"), qsTr("Other")];
            for (var i = 0; i < types.length; ++i) {
                otherShopTypeId = tx.executeSql("INSERT INTO shop_types (name) VALUES (?)", types[i]).insertId;
            }
            shopTypes = null;
        }

        /*
         * Set up shops and default shop 'other'.
         */
        tx.executeSql("\
            CREATE TABLE IF NOT EXISTS shops ( \
                id INTEGER PRIMARY KEY AUTOINCREMENT, \
                name TEXT UNIQUE NOT NULL, \
                type INTEGER NOT NULL, \
                category INTEGER NOT NULL \
            )");

        var otherShopId = -1;
        if (getShops().length === 0) {
            if (otherShopTypeId === -1 || otherCategoryId === -1) {
                throw { message: "Could not initialize database!" };
            }

            otherShopId = tx.executeSql("INSERT INTO shops (name, type, category) VALUES (?, ?, ?)",
                                        [qsTr("Other"), otherShopTypeId, otherCategoryId]).insertId;
            shops = null;
        }

        /*
         * Set up invoices.
         */
        tx.executeSql("\
            CREATE TABLE IF NOT EXISTS invoices ( \
                id INTEGER PRIMARY KEY AUTOINCREMENT, \
                at DATE NOT NULL, \
                shop INTEGER NOT NULL \
            )");

        tx.executeSql("\
            CREATE TABLE IF NOT EXISTS invoice_items ( \
                id INTEGER PRIMARY KEY AUTOINCREMENT, \
                invoice INTEGER NOT NULL,
                category INTEGER NOT NULL,
                remark TEXT,
                price DOUBLE NOT NULL
            )");

        tx.executeSql("\
            CREATE TABLE IF NOT EXISTS invoice_item_tags ( \
                id INTEGER PRIMARY KEY AUTOINCREMENT, \
                invoice_item INTEGER NOT NULL, \
                tag INTEGER NOT NULL
            )");

        if (withDemoData) {
            var invoiceId = tx.executeSql("INSERT INTO invoices (at, shop) VALUES (?, ?)", ["2015-01-15 12:00:00", otherShopId]).insertId;
            tx.executeSql("INSERT INTO invoice_items (invoice, category, price) VALUES (?, ?, ?)", [invoiceId, otherCategoryId, 5.0]);
        }
    });
}

/*
 * Returns list of objects containing name and type.
 */
function getShops()
{
    if (shops === null) {
        shops = [];
        var db = openDatabase();
        db.readTransaction(function(tx) {
            var rs = tx.executeSql("SELECT id, name FROM shops ORDER BY name");
            for (var i = 0; i < rs.rows.length; ++i) {
                shops.push({ id: rs.rows.item(i).id, name: rs.rows.item(i).name });
            }
        });
    }
    return shops;
}

/*
 * Returns information about a single shop; searched by name.
 */
function getShopByName(name)
{
    var result = null;
    var db = openDatabase();
    db.readTransaction(function(tx) {
        var rs = tx.executeSql("SELECT shops.id, shops.name, categories.id AS category_id, categories.name AS category_name \
                                FROM shops INNER JOIN categories ON shops.category = categories.id WHERE shops.name = ?", name);
        if (rs.rows.length !== 1) {
            throw { message: qsTr("Shop with the given name does not exist or name is not unique!") };
        }

        result = {
            id: rs.rows.item(0).id,
            name: rs.rows.item(0).name,
            category: {
                id: rs.rows.item(0).category_id,
                name: rs.rows.item(0).category_name
            }
        };
    });
    return result;
}

/*
 * Returns list of shop type names.
 */
function getShopTypes()
{
    if (shopTypes === null) {
        shopTypes = [];
        var db = openDatabase();
        db.readTransaction(function(tx) {
            var rs = tx.executeSql("SELECT id, name FROM shop_types ORDER BY name");
            for (var i = 0; i < rs.rows.length; ++i) {
                shopTypes.push({ id: rs.rows.item(i).id, name: rs.rows.item(i).name });
            }
        });
    }
    return shopTypes;
}

function getShopTypeByName(shopType)
{
    var db = openDatabase();
    var result = null;
    db.readTransaction(function (tx) {
        var rs = tx.executeSql("SELECT id, name FROM shop_types WHERE name = ?", shopType);
        if (rs.rows.length !== 1) {
            throw { message: qsTr("Shop type with the given name does not exist or shop type name is not unique!") };
        }
        result = { id: rs.rows.item(0).id, name: rs.rows.item(0).name };
    });
    return result;
}


/*
 * Returns list of category names.
 */
function getCategories()
{
    if (categories === null) {
        categories = [];
        var db = openDatabase();
        db.readTransaction(function(tx) {
            var rs = tx.executeSql("SELECT id, name FROM categories ORDER BY name");
            for (var i = 0; i < rs.rows.length; ++i) {
                categories.push({ id: rs.rows.item(i).id, name: rs.rows.item(i).name });
            }
        });
    }
    return categories;
}

/*
 * Adds a new shop with a given shop type.
 */
function addShop(name, type, category)
{
    var db = openDatabase();
    db.transaction(function(tx) {
        tx.executeSql("INSERT INTO shops (name, type, category) VALUES (?, ?, ?)", [name, type.id, category.id]);
    });

    shopTypes = null;
    shops = null;
}

/*
 * Adds a new item with a given category.
 */
function addCategory(category)
{
    var db = openDatabase();
    db.transaction(function(tx) {
        var categoryId = -1;
        var rs = tx.executeSql("SELECT id FROM categories WHERE name = ?", category);
        if (rs.rows.length > 0) {
            throw { message: qsTr("An item with the given name already exists!") };
        }
        rs = tx.executeSql("INSERT INTO categories (name) VALUES (?)", [category]);
    });

    categories = null;
}

function getCategoryByName(category)
{
    var db = openDatabase();
    var result = null;
    db.readTransaction(function (tx) {
        var rs = tx.executeSql("SELECT id, name FROM categories WHERE name = ?", category);
        if (rs.rows.length !== 1) {
            throw { message: qsTr("Category with the given name does not exist or category name is not unique!") };
        }
        result = { id: rs.rows.item(0).id, name: rs.rows.item(0).name };
    });
    return result;
}

/*
 * Adds a new invoice.
 */
function addBill(shop, date, items)
{
    var db = openDatabase();
    db.transaction(function (tx) {
        var dateStr = date.getFullYear() + "-" + date.getMonth() + "-" + date.getDate() + " " +
                        date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds() + "." +
                        date.getMilliseconds();
        var invoiceId = tx.executeSql("INSERT INTO invoices (at, shop) VALUES (?, ?)", [dateStr, shop.id]).insertId;
        for (var i = 0; i < items.length; ++i) {
            tx.executeSql("INSERT INTO invoice_items (invoice, category, price) VALUES (?, ?, ?)", [invoiceId, items[i].category.id, items[i].price]);
        }
    });
}

/*
 * Gets total costs.
 */
function getTotal()
{
    var db = openDatabase();
    var totalCosts = 0.;
    db.readTransaction(function (tx) {
        var rs = tx.executeSql("SELECT SUM(price) AS costs FROM invoice_items");
        if (rs.rows.length === 1 && rs.rows.item(0).price !== null) {
            totalCosts = rs.rows.item(0).costs;
        }
    });
    return totalCosts;
}
