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
    const Category = request.query.category;
    const subCategory = request.query.subCategory;
    const subSubCategory = request.query.subSubCategory;
    const productName = request.query.productName;
    const vendorUid = request.query.uid;
    const productDescription = request.query.productDescription;
    const hypeDescription = request.query.hypeDescription;
    let typesArray = request.query.typesArray;
    typesArray = JSON.parse(typesArray);
    const vendorExists = await (await firestore.doc(`vendors/${vendorUid}`).get()).exists;
    const productExists = await (await firestore.doc(`products/${vendorUid + productName}`).get()).exists;

    if (vendorExists && !productExists) {
        return await firestore.collection("products").doc(`${vendorUid + productName}`).set(
            {
                productName: productName,
                route: { Category: Category, subCategory: subCategory, subSubCategory: subSubCategory },
                productDescription: productDescription,
                hypeDescription: hypeDescription,
                StorageId: []
            }, { merge: true }
        ).then(() => {
            let ref = firestore.collection("products").doc(`${vendorUid + productName}`);
            const writePromises: Promise<any>[] = [];
            typesArray.forEach((element: Map<any, any>) => {
                writePromises.push(ref.collection("subProducts").add({ subProduct: element }));

            }

            );

            return Promise.all(writePromises);

        }

        ).catch((err) => response.send(`${err}`)).then(async () => {



            const reference = await firestore.doc(`vendors/${vendorUid}`).set(
                {
                    productName: [`${vendorUid + productName}`]

                }, { merge: true }

            );

            return Promise.resolve(reference)
        }).then(() => response.send("->>>")).catch((err) => {
            console.log(err);
            return response.send(`${err}`)
        });

    } else if (vendorUid && productExists) {
        return response.send(`you already have a ${productName} consider editing that product or delting it `);

    }
    else if (!vendorUid && !productExists) {
        return response.send('get a life you stupid fuck');
    }
    else {

        return response.send('get a life you stupid fuck');

    }







});


export const callCatagories = functions.https.onRequest(async (request, response) => {

    const fire = request.query.fire;

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

    for (let x in categories){
        for(let y in categories[x]){
            console.log(y)
            for(let z in categories[x][y]){
                console.log(z)
            }
        }
    }

    





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