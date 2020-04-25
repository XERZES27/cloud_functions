import * as functions from 'firebase-functions';
import admin = require('firebase-admin')
const app = admin.initializeApp();
const firestore = app.firestore();


// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//
// export const helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });


export const createDocumentForVerifiedUser = functions.https.onRequest(async (request, response) => {
    const userName = request.query.name;
    const userUid = request.query.uid;
    const userEmail = request.query.email;
    const isVerified = (await admin.auth().getUser(userUid)).emailVerified;
    if (isVerified) {

        return await firestore.doc(`users/${userUid}`).set(
            {
                UserName: userName,
                UserEmail: userEmail,
            }
        ).then(() =>
            response.send('Success')).catch((error) => {
                console.log(error)
                response.send(error)
            }
            );
    }
    else {
        console.log('email is not verified')
        return response.send('email is not verified')
    }
})


export const createDocumentForVerifiedVendor = functions.https.onRequest(async (request, response) => {
    const userName = request.query.name;
    const userUid = request.query.uid;
    const userEmail = request.query.email;
    const isVerified = (await admin.auth().getUser(userUid)).emailVerified;
    if (!isVerified) {

        return await firestore.doc(`vendors/${userUid}`).set(
            {
                UserName: userName,
                UserEmail: userEmail,

            }
        ).then(() =>
            response.send('Success')).catch((error) => {
                console.log(error)
                response.send(error)
            }
            );
    }
    else {
        console.log('email is not verified')
        return response.send('email is not verified')
    }
})

export const createProduct = functions.https.onRequest(async (request, response) => {
    const Catagory = request.query.catagory;
    const subCatagory = request.query.subCatagory;
    const subSubCatagory = request.query.subSubCatagory;
    const productName = request.query.productName;
    const vendorUid = request.query.uid;
    const productDescription = request.query.productDescription;
    const hypeDescription = request.query.hypeDescription;
    let typesArray = request.query.typesArray;
    typesArray = JSON.parse(typesArray);
    const vendorExists = await (await firestore.doc(`vendors/${vendorUid}`).get()).exists;
    const productExists = await (await firestore.doc(`products/${vendorUid + productName}`).get()).exists;
    const route = await firestore.doc(`Catagories/${Catagory}/subCatagory/${subCatagory}/subSubCatagory/${subSubCatagory}`);
    const writePromises: Promise<any>[] = [];
    if (!(await route.get()).exists) {
        return response.send("The category selection doesn't exist")
    }
    else {
        if (vendorExists && !productExists) {
            const createProductDocument = await firestore.collection("products").doc(`${vendorUid + productName}`).set(
                {
                    productName: productName,
                    route: { Catagory: Catagory, subCatagory: subCatagory, subSubCatagory: subSubCatagory },
                    productDescription: productDescription,
                    hypeDescription: hypeDescription,
                    StorageId: [],
                    review: [],
                    TotalAmount: 0,
                    SoldAmount: 0
                },
            ).then(() => {
                let ref = firestore.collection("products").doc(`${vendorUid + productName}`);
                typesArray.forEach((element: Map<any, any>) => {
                    writePromises.push(ref.collection("subProducts").add( element ));
                });
                return writePromises;
            }).catch((err) => {
                console.log(`${err}`)
                return 1
            })

            const addProductToCatagories = await firestore.doc(`Catagories/${Catagory}/subCatagory/${subCatagory}/subSubCatagory/${subSubCatagory}`).update({
                Products: admin.firestore.FieldValue.arrayUnion(`${vendorUid + productName}`)
            })
                .then(() => {
                    console.log(`${vendorUid + productName} in catagories`);
                    return 1;
                }).catch((err) => {
                    console.log(`${err}`)
                    return 1
                });


            const addProductToVendor = await firestore.doc(`vendors/${vendorUid}`).update(
                {
                    productName: admin.firestore.FieldValue.arrayUnion(`${vendorUid + productName}`)
                },
            ).then(() => {
                console.log(`${vendorUid + productName} in vendors`);
                return 1;
            }).catch((err) => {
                console.log(`${err}`)
                return 1
            });

            return Promise.all([createProductDocument, addProductToCatagories, addProductToVendor]).then(() => { response.send(`->>>`) })

        } else if (vendorUid && productExists) {
            return response.send(`you already have a ${productName} consider editing that product or delting it `);

        }
        else if (!vendorUid && !productExists) {
            return response.send('get a life you stupid fuck');
        }
        else {

            return response.send('get a life you stupid fuck');

        }

    }
});
//calculats the amount of total available products when there is an edit a subProduct(create,update,delete)
export const productAmountCalculator = functions.firestore.document('products/{productCollection}/subProducts/{subProductsCollection}').onWrite(async (change, context) => {
    if ((await firestore.doc(`products/${context.params.productCollection}`).get()).exists) {
        if (change.after.exists || change.before.exists) {
            const collections = firestore.collection(`products/${context.params.productCollection}/subProducts`).get()
            const ref = firestore.doc(`products/${context.params.productCollection}`)
            return collections
                .then((array) => {
                    let totalAmount = 0;
                    array.forEach((element) => {
                        totalAmount += element.data().amount;
                    });
                    return ref.update({
                        TotalAmount: totalAmount
                    })
                })
        }
        else {
            return null;
        }

    }
    else {
        return null;
    }

});

function compareMaps(map1, map2) {
    if (map1['Catagory'] === map2['Catagory'] && map1['subCatagory'] === map2['subCatagory'] && map1['subSubCatagory'] === map2['subSubCatagory']) {
        return true;
    }
    else {
        return false;
    }

}

// shoudl reflect all changes performed onto products to all references
export const onProductChange = functions.firestore.document('products/{productCollection}').onUpdate(async (change, context) => {
    const writePromises: Promise<any>[] = [];

    if (!compareMaps(change.after.data().route, change.before.data().route)) {
        console.log('onProductChange has buisness here')
        const oldRoute = change.before.data().route;
        const newRoute = change.after.data().route;
        const newRoute1 = await firestore.doc(`Catagories/${newRoute['Catagory']}/subCatagory/${newRoute['subCatagory']}/subSubCatagory/${newRoute['subSubCatagory']}`)

        if ((await newRoute1.get()).exists) {
            writePromises.push(firestore.doc(`Catagories/${oldRoute['Catagory']}/subCatagory/${oldRoute['subCatagory']}/subSubCatagory/${oldRoute['subSubCatagory']}`)
                .update({ Products: admin.firestore.FieldValue.arrayRemove(`${context.params.productCollection}`) }))
            writePromises.push(firestore.doc(`Catagories/${newRoute['Catagory']}/subCatagory/${newRoute['subCatagory']}/subSubCatagory/${newRoute['subSubCatagory']}`)
                .update({ Products: admin.firestore.FieldValue.arrayUnion(`${context.params.productCollection}`) }))

        }
        else {
            console.log(`new route doesn't exist`)
            writePromises.push(null);
        }
    }
    else {
        console.log('onProductChange has no buisness here')
        writePromises.push(null)
    }



    return Promise.all(writePromises)
})


export const onProductDelete = functions.firestore.document('vendors/{vendor}').onWrite((change, context) => {
    const writePromises: Promise<any>[] = [];
    if (change.after.exists && change.before.exists) {
        const oldProducts: Array<any> = change.before.data().productName;
        const newProducts: Array<any> = change.after.data().productName;
        const deletedProducts = new Array<any>();

        if (oldProducts.length > newProducts.length) {
            oldProducts.forEach(element => {
                console.log(`TOBE deleted ${element}`);
                if (!newProducts.includes(element)) {
                    console.log(`TOBE deleted ${element}`);
                    deletedProducts.push(element);
                }
            });
            deletedProducts.forEach(element => {
                writePromises.push(firestore.doc(`products/${element}`).delete()
                    .then(() =>
                        admin.firestore().collection(`products/${element}/subProducts`).listDocuments())
                    .then((doc) => {
                        doc.map((val) => val.delete())
                    })
                    .catch((err) => console.log(`${err}`)));
            })

        }
    }
    else if (!change.after.exists && change.before.exists) {
        const oldProducts: Array<any> = change.before.data().products;
        oldProducts.forEach(element => {
            console.log(`TOBE deleted ${element}`);
            firestore.collection(`products`)
            writePromises.push(firestore.collection(`products`).doc(`${element}`).delete());
        })

    }
    else if (change.after.exists && !change.before.exists) {
        writePromises.push(null)
    }
    else {

        writePromises.push(null)
    }
    return Promise.all(writePromises)

})

export const createReview_v1 = functions.https.onRequest( (request, response) =>{
    const type = request.query.type;
    const rating = request.query.rating;
    const body = request.query.body;
    const userId: any = request.query.userId;
    const productId: any = request.query.productId;

    firestore.collection('reviews').doc(`${productId + userId}`).set(
        {
            type: type,
            rating: rating,
            body: body,
            storageArray: [],
            userId: userId,
            productId: productId,
        }
    ).then( async () => {
        await firestore.collection('products').doc(`${productId}`).update({
            review: admin.firestore.FieldValue.arrayUnion(`${productId + userId}`),
        })
    }).then( async () => {
        await firestore.collection('users').doc(`${userId}`).update({
            reviews: admin.firestore.FieldValue.arrayUnion(`${productId + userId}`),
        })
        response.send('SUCCESS!');
    }).catch(e => {
        console.log(e);
        response.send(500);
    });
});


export const buyProduct = functions.https.onRequest(async (request, response) => {

    const product = request.query.product;
    const subProduct = request.query.subProduct;
    const purchaseAmount = request.query.purchaseAmount

    const subProductroute = firestore.doc(`products/${product}/subProducts/${subProduct}`);
    const productRoute = firestore.doc(`products/${product}`)
    if ((await subProductroute.get()).exists) {
        return firestore.runTransaction((transaction) => {


            return transaction.getAll(subProductroute,productRoute).then((documentArray)=>{

                    const subProductAmount = documentArray[0].get('amount');
                    const SoldProductAmount = documentArray[1].get('SoldAmount')
                    transaction.set(subProductroute,
                        {
                            subProduct: {
                                amount: subProductAmount - purchaseAmount
                            }

                        },{merge:true})
                    transaction.update(productRoute,{
                        SoldAmount: SoldProductAmount + purchaseAmount

                    })



            })

            // return transaction.get(route).then((document) => {
            //     transaction.getAll
            //     const subProudctAmount = document.data().amount;
            //     transaction.update(route, {
            //         subProduct: {
            //             amount: subProudctAmount - purchaseAmount
            //         }
            //     })
            // }).then(() => {
            //     return transaction.get(firestore.doc(`products/${product}`))
            //         .then((document) => {
                        
            //             const SoldAmount = document.data().SoldAmount

            //             transaction.update(route, {
            //                 subProduct: {
            //                     amount: subProudctAmount - purchaseAmount
            //                 }
            //             })

            //             transaction.update(firestore.doc(`products/${product}`),
            //                 {
            //                     SoldAmount: SoldAmount + purchaseAmount
            //                 })
            //         })
            // });
        }).then(()=>{
            console.log(`transaction is  succesful`) 
            response.send('->>>')
        }).catch((err)=>{
            console.log(`${err}`)
            response.send(`${err}`)
        })



    }

})


export const callCatagories = functions.https.onRequest(async (request, response) => {

    const fire = request.query.fire;
    if (fire) {
        response.send("hell blade")
    }

    var categories = {
        "Phone and Accessories": {
            "Mobile Phones": { "Lenovo": "", "OnePlus": "", "Huawei": "", "Samsung Galaxy": "", "Iphone": "", "Techno": "", "Itel": "", "Feature Phones": "" },
            "Tablets": { "Lenovo": "", "Samsung Galaxy": "", "Iphone": "", "Techno": "", "Itel": "" },
            "Mobile Accessories": { "Covers & Cases": "", "Chargers": "", "Cables": "", "Batteries": "", "Wireless charger": "", "Car Charger": "" }
        },
        "Electronics & Appliance": {
            "TV Accessories": { "Televisions": "", "TV Receivers": "", "Projectors": "", "Tv Sticks": "", "Audio Amplifiers": "" },
            "Household Appliance": { "Household Appliance": "", "Light Bulb	Hardware": "", "Kitchen & Bath Fixtures": "", "Power cables & Hand Tools": "", "Painting Supplies": "" }
        },
        "Home & Living": {
            "Home": { "Cushions": "", "Curtains": "", "Bedding sets": "", "Towels": "", "wall clock": "", "Vacuums": "", },
            "kitchen": { "Dining sets Knives": "", "Microwave": "", "Pressure cooker": "", "Bathroom Accessories": "", },
            "outdoor": { "Watering Kits": "", "Flower Pots": "", "Outdoor Furniture": "", "Yoga mats": "", "Basketballs": "", "Dumb Bells": "", }
        },
        "Men's Fashion": {
            "Men's Apparels": { "Trousers": "", "Boxers": "", "Swaters	Shirts": "", "T-shirts": "", "Hoodies": "", },
            "Men's Shoes": { "Adidas": "", "Nike": "", "Vans": "", "Oldschool": "", "Sandles": "", },
            "Men's  Bag's": { "Backpacks": "", "Crossbody": "", "Briefcases": "", },
            "Men's Accessories": { "Wallets": "", "Cardholders": "", "Passport": "", "covers": "", "Kids": "", "bags": "", },
            "Men's Sport": { "Flip flop": "", "Jerseys	Shorts": "", "Sport bags": "", }
        },
        "Women's Fashion": {
            "Women's Apparels": { "Bra's": "", "Dresses	skirts": "", "Trending styles": "", "Blouses & shirts": "", "Jackets": "", },
            "Women's  Shoes": { "Flats": "", "High Heels": "", "Boots": "", "Sneakers": "", "House Slippers": "", },
            "Women's  Bag's": { "Stylish Backpacks": "", "Evening Bags": "", "Shoulder Bags": "", "Purse": "", "Fanny packs": "", },
            "Women's Accessories": { "Cosmotic bags": "", "EarWear	Hats": "", "Scarves & Warps": "", "Costumes": "", },
            "Women's  Sport": { "Swimsuits": "", "Beachwear": "", }
        },
        "Baby, kids and maternity": {
            "Baby care": { "Diaper": "", "Thermometer": "", "Blankets": "", "Baby oils": "", },
            "Toys": { "Play Mat": "", "Stiffed Animals": "", "Toy Vehicles": "", },
            "Clothing": { "Baby boy": "", "Baby girl": "", "Clogs": "", },
            "Maternity": { "Maternity Clothing": "", }
        },
        "Computer and Accessories": {
            "Computers": { "Laptops": "", "Desktops": "", },
            "Performance": { "Gaming": "", "Servers": "", },
            "Printers and Copiers": { "Printers": "", "Copiers": "", "Heavy Duty": "", },
            "Others": { "Scanners": "", "Routers": "", "Hubs": "", "Swicths": "", "Modems": "", }
        },
        "Office Products": {
            "Office Basics": { "Stationery": "", "Pencils and Pens": "", "Printers": "", "Scanners": "", },
            "Office Furniturers": { "Tables": "", "Chairs": "", "Shelves": "", "Cabinets": "", }
        },
        "Health and Beauty": {
            "Hair and Nails": { "wigs": "", "Nails": "", "Lip": "", "Tools": "", },
            "Beauty and Care": { "Perfume Deaodrants": "", "Makeups": "", "Adult Items": "", },
            "Health Suppliments": { "Suppliments": "", "Multi-Vitamins": "", }
        }
    };

    const writePromises: Promise<any>[] = [];
    for (const catagory in categories) {
        writePromises.push(firestore.doc(`Catagories/${catagory}`).set({}).then(() => { console.log(`${catagory}`); return response.send(`${catagory}`) }).catch((err) => { return response.send(`${err}`) }))
        for (let subCategory in categories[catagory]) {
            writePromises.push(firestore.doc(`Catagories/${catagory}/subCatagory/${subCategory}`).set({}).then(() => { console.log(`${subCategory}`); return response.send(`${subCategory}`) }).catch((err) => { return response.send(`${err}`) }));
            for (let subSubCategory in categories[catagory][subCategory]) {
                writePromises.push(firestore.doc(`Catagories/${catagory}/subCatagory/${subCategory}/subSubCatagory/${subSubCategory}`)
                    .set({ Products: [] })
                    .then(() => {
                        console.log(`${subSubCategory}`);
                        return response.send(`${subCategory}`)
                    })
                    .catch((err) => {
                        return response.send(`${err}`)
                    }));




            }

        }
    }


    return Promise.all(writePromises);



})












export const test = functions.https.onRequest(async (request, response) => {




    let array = request.query.array;
    array = JSON.parse(array);
    //  const newArray = new Array()
    //  array.forEach((element: any) => {
    //     newArray.push(JSON.parse(element)) 
    //  });
    console.log(array);
    return await firestore.collection("tests").add({ array: array }).then(() => { return response.send('->>>'); }).catch((err) => { return response.send(`${err}`) });

})