import * as functions from 'firebase-functions';
import admin = require('firebase-admin')
// const {Storage} = require('@google-cloud/storage');
const app = admin.initializeApp();
const firestore = app.firestore();
const firebase_storage = app.storage();
// const path = require('path');
// const os = require('os');
// const fs = require('fs');


// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//
// export const helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });

export const writeImagesPathToVendorDocument = functions.https.onCall(async(data,context)=>{
    const pathOfImagesDocument :String= data.pathOfImagesDocument;
    const token = data.token;
    return admin.auth().verifyIdToken(token).then((decodedId)=>{
        return admin.auth().getUser(decodedId.uid).then(async(user)=>{
            if(user.customClaims.Vendor === true){
                await firestore.doc(`vendors/${decodedId.uid}`).update(
                    {
                        pathOfAllUploadedImageDocuments : admin.firestore.FieldValue.arrayUnion(`${pathOfImagesDocument}`)
                    }
                    
                ).catch((error)=>{
                    return { Error: `${error}` }
                })
                return {Complete:`success`}
            }else{
                return { Error: 'This Account is Not a Vendor' }
            }
        })
    })
})


export const deleteImagesPathFromVendorDocument = functions.https.onCall(async(data,context)=>{

    const pathOfImagesDocument :String =  data.pathOfImagesDocument;
    const token = data.token;
    return admin.auth().verifyIdToken(token).then((decodedId)=>{
        return admin.auth().getUser(decodedId.uid).then((user)=>{
            if(user.customClaims.Vendor === true){
                return firestore.doc(`vendors/${decodedId.uid}`).update(
                    {
                        pathOfAllUploadedImageDocuments : admin.firestore.FieldValue.arrayRemove(`${pathOfImagesDocument}`)
                    }
                ).catch((error)=>{
                    return { Error: `${error}` }
                }).then(()=> {
                        return firebase_storage.bucket().deleteFiles({
                            prefix:`products/${pathOfImagesDocument}`,
                            force:true
                        }).then(()=>{
                                return {Complete:"Success"}
                                
                        }).catch((err)=>{
                            return {Error:`${err}`}
                        })    
                }).catch((error)=>{
                    return {Error:`${error}`}
                })
            }else{
                return { Error: 'This Account is Not a Vendor' }
            }
        })
    })
})

export const deleteImagesPathFromVendorDocumentV = functions.https.onRequest(async(request,response)=>{

    const pathOfImagesDocument :String =  request.query.pathOfImagesDocument;
    const token = request.query.token;

    return admin.auth().verifyIdToken(token).then((decodedId)=>{
        return admin.auth().getUser(decodedId.uid).then(async(user)=>{
            if(user.customClaims.Vendor === true){
                return firestore.doc(`vendors/${decodedId.uid}`).update(
                    {
                        pathOfAllUploadedImageDocuments : admin.firestore.FieldValue.arrayRemove(`${pathOfImagesDocument}`)
                    }
                    
                ).then(async()=> {
                        return admin.storage().bucket("backend-tests-9b517.appspot.com").file(`${pathOfImagesDocument}`).delete().then(()=>{
                            return response.send(":)")
                        }).catch((error)=>{
                            console.log(`${error.message}`)
                            return response.send(error)
                        })               

                }).catch((error)=>{
                    return response.send(error)
                })
            }else{
                return response.send('This Account is Not a Vendor' )
            }
        })
    })
})

function mapContainsAllArrayValues(data:Map<string,any>,array:Array<string>){
    var containsAllValues:boolean = true;
    array.forEach((element)=>{
        if(!(element in data)){
            containsAllValues = false;
        }
    });
    return containsAllValues;
}

function contructEditableUnPublishedProductFields(data:Map<string,any>){
    const mapKeys:Array<string> = ["productName", "productDescription" ,"hypeDescription", "imageReferenceArray", "displayProductImagePath" ,"pathOfImagesDocument"];
    const newMap : Map<string,any> = new Map<string,any> ();
    mapKeys.forEach((element)=>{
        if(element in data){
            newMap.set(element,data.get(element))
        }
    });
    const categoryKeys:Array<string> = ["catagory","subCatagory","subSubCatagory"];
    if(mapContainsAllArrayValues(data,categoryKeys)){
        newMap.set('route', {Catagory:data.get("catagory"),subCatagory:data.get("subCatagory"),subSubCatagory:data.get("subSubCatagory")})
    }
    return newMap;
}

function contructEditablePublishedProductFields(data){
    const mapKeys:Array<string> = [ "imageReferenceArray"];
    const newMap : Map<string,any> = new Map<string,any> ();
    mapKeys.forEach((element)=>{
        if(element in data){
            newMap.set(element,data.get(element))
        }
    });
    return newMap;
}

function constructSubProductMapForPublishedProducts(subProductMap:Map<string,any>){
    const newSubProductMap:Map<string,any> = new Map<string,any> ();
    if(subProductMap.has("AMOUNT")){
        
        newSubProductMap.set("AMOUNT",subProductMap.get("AMOUNT"));
    }
    if(subProductMap.has("PRICE")){
        
        newSubProductMap.set("PRICE",subProductMap.get("PRICE"));
    }
    return newSubProductMap;
}


export const editPublishedProduct = functions.https.onCall(async(data,context)=>{
    const token = data.token;
    const formattedData:Map<string,any> = contructEditablePublishedProductFields(data);
    return admin.auth().verifyIdToken(token).then((decodedId) => {
        return admin.auth().getUser(decodedId.uid).then(async (user) => {
            if(user.customClaims.Vendor === true){
                const productExists = (await firestore.doc(`products/${decodedId.uid + formattedData.get("productName")}`).get()).exists;
                const route = await firestore.doc(`Catagories/${formattedData.get("catagory")}/subCatagory/${formattedData.get("subCatagory")}/subSubCatagory/${formattedData.get("subSubCatagory")}`);
                if(!productExists){
                    if((await route.get()).exists){
                        return firestore.collection("products").doc(`${decodedId.uid+formattedData.get("productName")}`).update(
                            formattedData
                        ).then(()=>{
                            const writePromises: Promise<any>[] = [];
                            if("subProductsArray" in data){
                                const subProductsArray:Array<Map<any,any>> = JSON.parse(JSON.stringify(data.subProductsArray));
                                const ref =  firestore.collection("products").doc(`${decodedId.uid+formattedData.get("productName")}`)
                                subProductsArray.forEach((element:Map<string, any>)=>{
                                    const subProductDocumentId:string = element.get("documentId");
                                    element.delete("documentId");
                                    var newMap = constructSubProductMapForPublishedProducts(element);
                                    writePromises.push(
                                        ref.collection("subProducts").doc(subProductDocumentId).update(
                                            newMap
                                        )
                                    )
                                })
                            }
                        });
                    }
                    else{
                        return { Error: `The category selection doesn't exist` };
                    }
                    
                }else {
                    return { Error: `you already have a ${formattedData.get("productName")} consider editing that product or delting it ` };
                }

            }else {
                return { Error: 'This Account is Not a Vendor' }
            }
        })

    })





})

export const editUnPublishedProduct = functions.https.onCall(async(data,context)=>{
    const token = data.token;
    const formattedData:Map<string,any> = contructEditableUnPublishedProductFields(data);
    return admin.auth().verifyIdToken(token).then((decodedId) => {
        return admin.auth().getUser(decodedId.uid).then(async (user) => {
            if(user.customClaims.Vendor === true){
                const productExists = (await firestore.doc(`products/${decodedId.uid + formattedData.get("productName")}`).get()).exists;
                const route = await firestore.doc(`Catagories/${formattedData.get("catagory")}/subCatagory/${formattedData.get("subCatagory")}/subSubCatagory/${formattedData.get("subSubCatagory")}`);
                if(!productExists){
                    if((await route.get()).exists){
                        return firestore.collection("unpublishedProducts").doc(`${decodedId.uid+formattedData.get("productName")}`).update(
                            formattedData
                        ).then(()=>{
                            const writePromises: Promise<any>[] = [];
                            if("subProductsArray" in data){
                                const subProductsArray:Array<Map<any,any>> = JSON.parse(JSON.stringify(data.subProductsArray));
                                const ref =  firestore.collection("unpublishedProducts").doc(`${decodedId.uid+formattedData.get("productName")}`)
                                subProductsArray.forEach((element:Map<any, any>)=>{
                                    const subProductDocumentId:string = element.get("documentId");
                                    element.delete("documentId");
                                    writePromises.push(
                                        ref.collection("subProducts").doc(subProductDocumentId).update(
                                            element
                                        )
                                    )
                                })
                            }
                        });
                    }
                    else{
                        return { Error: `The category selection doesn't exist` };
                    }
                    
                }else {
                    return { Error: `you already have a ${formattedData.get("productName")} consider editing that product or delting it ` };
                }

            }else {
                return { Error: 'This Account is Not a Vendor' }
            }
        })

    })





})


export const createProductCallable = functions.https.onCall(async (data, context) => {
    const token = data.token;
    const Catagory = data.catagory;
    const subCatagory = data.subCatagory;
    const subSubCatagory = data.subSubCatagory;
    const productName: String = data.productName;
    const productDescription = data.productDescription;
    const hypeDescription = data.hypeDescription;
    const displayProductImagePath = data.displayProductImagePath;
    const pathOfImagesDocument = data.pathOfImagesDocument;
    let subProductsArray: any = data.subProductsArray;
    console.log(displayProductImagePath);
    subProductsArray = JSON.parse(JSON.stringify(subProductsArray));
    const imageReferenceArray = JSON.parse(JSON.stringify(data.imageReferenceArray));
    // const strippedProductName = productName.replace(" ","");
    return admin.auth().verifyIdToken(token).then((decodedId) => {
        return admin.auth().getUser(decodedId.uid).then(async (user) => {
            if (user.customClaims.Vendor === true) {
                const productExists = (await firestore.doc(`products/${decodedId.uid + productName}`).get()).exists;
                const route = await firestore.doc(`Catagories/${Catagory}/subCatagory/${subCatagory}/subSubCatagory/${subSubCatagory}`);
                if (!productExists) {
                    if ((await route.get()).exists) {
                        return firestore.collection("products").doc(`${decodedId.uid + productName}`).set(
                            {
                                productName: productName,
                                route: { Catagory: Catagory, subCatagory: subCatagory, subSubCatagory: subSubCatagory },
                                productDescription: productDescription,
                                hypeDescription: hypeDescription,
                                imageReferenceArray: imageReferenceArray,
                                displayProductImagePath:displayProductImagePath,
                                pathOfImagesDocument: pathOfImagesDocument,
                                review: [],
                                TotalAmount: 0,
                                SoldAmount: 0,
                                publishedProduct:true,
                            },
                        ).then(() => {
                            const writePromises: Promise<any>[] = [];
                            let ref = firestore.collection("products").doc(`${decodedId.uid + productName}`);
                            subProductsArray.forEach((element: Map<any, any>) => {
                                writePromises.push(ref.collection("subProducts").add(element));
                            });
                            return writePromises;
                        }).then(() => {
                            return firestore.doc(`Catagories/${Catagory}/subCatagory/${subCatagory}/subSubCatagory/${subSubCatagory}`).update({
                                Products: admin.firestore.FieldValue.arrayUnion(`${decodedId.uid + productName}`)
                            })
                        }).then(() => {
                            return firestore.doc(`vendors/${decodedId.uid}`).update(
                                {
                                    productNames: admin.firestore.FieldValue.arrayUnion(`${decodedId.uid + productName}`)
                                },
                            )
                        })
                        // .then(()=>{
                        //     return firestore.doc(`vendors/${decodedId.uid}`).update(
                        //         {
                        //             pathOfAllUploadedImageDocuments : admin.firestore.FieldValue.arrayRemove(`${pathOfImagesDocument}`)
                        //         }
                        //     )
                        // })
                        .then(() => {
                            return { Complete: 'Complete' }
                        }
                        ).catch((error) => {
                            return { Error: `${error}` }
                        })
                    }
                    else {
                        return { Error: `The category selection doesn't exist` };
                    }
                }
                else {
                    return { Error: `you already have a ${productName} consider editing that product or delting it ` }
                }
            }
            else {
                return { Error: 'This Account is Not a Vendor' }
            }
        })
    }).catch((error)=>{
        return {Error:`${error}`}
        }
    )
})





export const createUnPublishedProductCallable = functions.https.onCall(async (data, context) => {
    const token = data.token;
    const Catagory = data.catagory;
    const subCatagory = data.subCatagory;
    const subSubCatagory = data.subSubCatagory;
    const productName: String = data.productName;
    const productDescription = data.productDescription;
    const hypeDescription = data.hypeDescription;
    const displayProductImagePath = data.displayProductImagePath;
    const pathOfImagesDocument = data.pathOfImagesDocument;
    let subProductsArray: any = data.subProductsArray;
    console.log(displayProductImagePath);
    subProductsArray = JSON.parse(JSON.stringify(subProductsArray));
    const imageReferenceArray = JSON.parse(JSON.stringify(data.imageReferenceArray));
    // const strippedProductName = productName.replace(" ","");
    return admin.auth().verifyIdToken(token).then((decodedId) => {
        return admin.auth().getUser(decodedId.uid).then(async (user) => {
            if (user.customClaims.Vendor === true) {
                const productExists = (await firestore.doc(`products/${decodedId.uid + productName}`).get()).exists;
                const route = await firestore.doc(`Catagories/${Catagory}/subCatagory/${subCatagory}/subSubCatagory/${subSubCatagory}`);
                if (!productExists) {
                    if ((await route.get()).exists) {
                        return firestore.collection("unpublishedProducts").doc(`${decodedId.uid + productName}`).set(
                            {
                                productName: productName,
                                route: { Catagory: Catagory, subCatagory: subCatagory, subSubCatagory: subSubCatagory },
                                productDescription: productDescription,
                                hypeDescription: hypeDescription,
                                imageReferenceArray: imageReferenceArray,
                                displayProductImagePath:displayProductImagePath,
                                review: [],
                                publishedProduct:false,
                                pathOfImagesDocument: pathOfImagesDocument,
                                TotalAmount: 0,
                                SoldAmount: 0
                            },
                        ).then(() => {
                            const writePromises: Promise<any>[] = [];
                            let ref = firestore.collection("unpublishedProducts").doc(`${decodedId.uid + productName}`);
                            subProductsArray.forEach((element: Map<any, any>) => {
                                writePromises.push(ref.collection("subProducts").add(element));
                            });
                            return writePromises;
                        })
                        // .then(() => {
                        //     return firestore.doc(`Catagories/${Catagory}/subCatagory/${subCatagory}/subSubCatagory/${subSubCatagory}`).update({
                        //         Products: admin.firestore.FieldValue.arrayUnion(`${decodedId.uid + productName}`)
                        //     })
                        // }).
                        
                        .then(() => {
                            return firestore.doc(`vendors/${decodedId.uid}`).update(
                                {
                                    unpublishedProductsNames: admin.firestore.FieldValue.arrayUnion(`${decodedId.uid + productName}`)
                                },
                            )
                        }).then(()=>{
                            return firestore.doc(`vendors/${decodedId.uid}`).update(
                                {
                                    pathOfAllUploadedImageDocuments : admin.firestore.FieldValue.arrayRemove(`${pathOfImagesDocument}`)
                                }
                            )
                        })
                        .then(() => {
                            return { Complete: 'Complete' }
                        }
                        ).catch((error) => {
                            return { Error: `${error}` }
                        })
                    }
                    else {
                        return { Error: `The category selection doesn't exist` };
                    }
                }
                else {
                    return { Error: `you already have a ${productName} consider editing that product or delting it ` }
                }
            }
            else {
                return { Error: 'This Account is Not a Vendor' }
            }
        })
    }).catch((error)=>{
        return {Error:`${error}`}
        }
    )
})


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


export const checkifVerified = functions.https.onCall((data, context) => {
    return admin.auth().getUser(context.auth.uid).then((user) => {
        if (user.emailVerified) {
            return { "emailVerified": true }
        }
        else {
            return { "emailVerified": false }
        }
    }).catch((error) => {
        return { Error: `${error}` }
    });
});


export const createDocumentForVendor = functions.https.onRequest(async (request, response) => {
    const userName: string = request.query.userName
    const userEmail: string = request.query.userEmail
    return admin.auth().getUserByEmail(userEmail).then(async (user) => {
        if (user.emailVerified) {
            return firestore.doc(`vendors/${user.uid}`).set(
                {
                    UserName: `${userName}`,
                    UserEmail: `${user.email}`,
                }
            ).then(async () => {
                await admin.auth().setCustomUserClaims(user.uid, { Vendor: true })
                return response.send(`${userName} is a Vendor ( ͡• ͜ʖ ͡• )`);
            })
        }
        else {
            return response.send(`${userName} is not yet verified (._. )>`)
        }
    })
})


export const createDocumentForVerifiedVendorCallable = functions.https.onCall(async (data, context) => {
    const userName = data.name;
    const token = data.token;

    const approvedVendords = await firestore.doc('Admin-Panel/Approved_Vendors').get();
    const approvedVendorsArray: Array<string> = approvedVendords.data().approvedVendors;
    return admin.auth().verifyIdToken(token).then(async (decodedId) => {
        const user = await admin.auth().getUser(decodedId.uid);
        const vendorIsApproved = approvedVendorsArray.includes(user.email);
        if (user.emailVerified && vendorIsApproved) {
            return firestore.doc(`vendors/${decodedId.uid}`).set(
                {
                    UserName: `${userName}`,
                    UserEmail: `${user.email}`,
                }
            ).then(async () => {
                await admin.auth().setCustomUserClaims(decodedId.uid, { Vendor: true })
                return { Complete: `${userName}` };
            })
                .catch((error) => {
                    return { Error: `${error}` }
                });
        }
        else if (user.emailVerified && !vendorIsApproved) {
            return { Error: 'vendor is not approved' }
        }
        else if (!user.emailVerified && vendorIsApproved) {
            return { Error: 'email is not verified' }
        }
        else {
            return { Error: 'Email is not verified & Vendor is not Approved' }
        }
    }).catch((error) => {
        return { Error: `Invalid User ${error}` }

    })
})

export const approveVendorEmail = functions.https.onRequest((request, response) => {

    const email = request.query.email;

    firestore.collection('Admin-Panel').doc('Approved_Vendors').update({
        approvedVendors: admin.firestore.FieldValue.arrayUnion(email),
    }).then(() => {
        return response.send('SUCCESS! ψ(._. )>');
    }).catch((e) => {
        return response.send(e);
    });
});


export const attachImagesToProduct = functions.https.onCall(async (data, context) => {

    const vendorUid = context.auth.uid;
    const productName = data.productName;
    const Images: Array<String> = data.Images;
    const product = firestore.doc(`products/${vendorUid + productName}`)
    if (!(await product.get()).exists) {
        return { Error: `Invalid Parameters` }
    }
    else {
        const promises = [];
        Images.forEach((element: String) => {
            promises.push(product.update({
                StorageId: admin.firestore.FieldValue.arrayUnion(`${element}`)
            }))
        })
        return Promise.all(promises)
            .then(() => {
                return { Complete: "Upload has completed" }
            })
            .catch((error) => {
                return { Error: `${error}` }
            })
    }
})




export const attachImageToProduct = functions.storage.object().onFinalize(async (image) => {

    if (image.contentType.startsWith('products/')) {
        console.log('This is not a products.');
    }
    else {
        console.log(`${image.name}`)
        console.log(`${image.contentType}`)
    }
})


export const createReview = functions.https.onCall(async (data, context) => {
    const type = data.type;
    const rating = data.rating;
    const body = data.body;
    const productId: any = data.productId;
    const token = String(context.auth.token)
    await admin.auth().verifyIdToken(token).then(async (decodedId) => {
        const userId = decodedId.uid;
        const userRoute = firestore.doc(`users/${userId}`);
        if (await (await userRoute.get()).exists) {
            if ((await firestore.collection('reviews').doc(`${productId + userId}`).get()).exists) {
                return { Error: 'You have already reviewed this product!' };
            } else {
                return firestore.collection('reviews').doc(`${productId + userId}`).set(
                    {
                        type: type,
                        rating: rating,
                        body: body,
                        storageArray: [],
                        userId: userId,
                        productId: productId,
                    }
                ).then(async () => {
                    await firestore.collection('products').doc(`${productId}`).update({
                        review: admin.firestore.FieldValue.arrayUnion(`${productId + userId}`),
                    });
                }).then(async () => {
                    await firestore.collection('users').doc(`${userId}`).update({
                        reviews: admin.firestore.FieldValue.arrayUnion(`${productId + userId}`),
                    });
                    return { SUCCESS: "Complete" }
                }).catch(e => {
                    console.log(e);
                    return { Error: `${e}` }
                });
            }
        }
        else {
            console.log(`Hack Attempt`)
            return { Error: "INVALID PARAMETERS" }
        }
    })
        .catch((error) => {
            console.log(`${error}`)
            return { Error: "INVALID PARAMETERS" }
        })
});

export const editReview = functions.https.onRequest(async (request, response) => {
    const rating = request.query.rating;
    const body = request.query.body;
    const reviewId: any = request.query.reviewId;

    firestore.collection('reviews').doc(reviewId).update(
        {
            rating: rating,
            body: body,
            storageArray: [],
        }
    ).then(() => {
        response.send('SUCCESS!');
    }).catch(e => {
        console.log(e);
        response.send(500);
    });
});



export const createProduct_v2 = functions.https.onRequest(async (request, response) => {
    const Catagory = request.query.catagory;
    const subCatagory = request.query.subCatagory;
    const subSubCatagory = request.query.subSubCatagory;
    const productName: any = request.query.productName;
    const vendorUid = request.query.uid;
    const productDescription = request.query.productDescription;
    const hypeDescription = request.query.hypeDescription;
    let typesArray: any = request.query.typesArray;
    typesArray = JSON.parse(typesArray);
    const vendorExists = (await firestore.doc(`vendors/${vendorUid}`).get()).exists;
    const productExists = (await firestore.doc(`products/${vendorUid + productName}`).get()).exists;
    const route = await firestore.doc(`Catagories/${Catagory}/subCatagory/${subCatagory}/subSubCatagory/${subSubCatagory}`);
    if (!(await route.get()).exists) {
        return response.send("The category selection doesn't exist");
    }
    else {
        if (vendorExists && !productExists) {
            return firestore.collection("products").doc(`${vendorUid + productName}`).set({
                productName: productName,
                route: { Catagory: Catagory, subCatagory: subCatagory, subSubCatagory: subSubCatagory },
                productDescription: productDescription,
                hypeDescription: hypeDescription,
                StorageId: [],
                review: [],
                TotalAmount: 0,
                SoldAmount: 0,
                productHistory: []
            }).then(() => {
                const promises = [];
                let ref = firestore.collection("products").doc(`${vendorUid + productName}`);
                typesArray.forEach((element: Map<any, any>) => {
                    promises.push(ref.collection("subProducts").add(element));
                });
                return Promise.all(promises);
            }).then(async () => {
                await firestore.doc(`Catagories/${Catagory}/subCatagory/${subCatagory}/subSubCatagory/${subSubCatagory}`).update({
                    Products: admin.firestore.FieldValue.arrayUnion(`${vendorUid + productName}`)
                })
                await firestore.doc(`vendors/${vendorUid}`).update(
                    {
                        productName: admin.firestore.FieldValue.arrayUnion(`${vendorUid + productName}`)
                    },
                ).then(() => {
                    console.log(`${vendorUid + productName} in vendors`);
                    return response.send(`->>>`)
                });
            }).catch((err) => {
                console.log(`${err}`);
                return response.send(err);
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
    }
});




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
                    writePromises.push(ref.collection("subProducts").add(element));
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

function deleteUnpublishedProductsCleanUp(oldProducts:Array<String>,newProducts:Array<String>){
    const writePromises: Promise<any>[] = [];
    if(oldProducts.length!==0 && oldProducts.length>newProducts.length){
        const deletedProducts = new Array<String>();
        
        oldProducts.forEach(element => {
            if (!newProducts.includes(element)) {
                deletedProducts.push(element);
            }
        });
        deletedProducts.forEach(element=>{
            writePromises.push(
                firestore.doc(`unpublishedProducts/${element}`).get()
                .then((values)=>{
                    const pathOfImagesDocument:String = values.data().pathOfImagesDocument;
                    return firebase_storage.bucket().deleteFiles({
                        prefix:`products/${pathOfImagesDocument}`,
                        force:true
                    })

                }).then(()=>{
                    return firestore.doc(`unpublishedProducts/${element}`).delete()
                    .then(() =>
                         admin.firestore().collection(`unpublishedProducts/${element}/subProducts`).listDocuments())
                    .then((doc) => {
                        doc.map((val) => {
                            return val.delete()
                        })
                    })
                    .catch((err) => console.log(`${err}`))
                })
            )
        })
    }
    return Promise.all(writePromises);


}

function deletePublishedProductsCleanUp(oldProducts:Array<String>,newProducts:Array<String>){
    const writePromises: Promise<any>[] = [];
    if (oldProducts.length > newProducts.length) {
        const deletedProducts = new Array<any>();
        oldProducts.forEach(element => {
            console.log(`TOBE deleted ${element}`);
            if (!newProducts.includes(element)) {
                console.log(`TOBE deleted ${element}`);
                deletedProducts.push(element);
            }
        });
        deletedProducts.forEach(element => {
            writePromises.push(
                firestore.doc(`products/${element}`).get()
                
                .then((values) => {
                const ProductRoute = values.data().route
                return firestore.doc(`Catagories/${ProductRoute['Catagory']}/subCatagory/${ProductRoute['subCatagory']}/subSubCatagory/${ProductRoute['subSubCatagory']}`)
                    
                .update({ Products: admin.firestore.FieldValue.arrayRemove(`${element}`) })
                    
                    .then(()=>{
                        const pathOfImagesDocument:String = values.data().pathOfImagesDocument;
                        return firebase_storage.bucket().deleteFiles({
                            prefix:`products/${pathOfImagesDocument}`,
                            force:true
                        })
                    })
            })
                .then(() => {
                    firestore.doc(`products/${element}`).delete()
                        .then(() =>
                            admin.firestore().collection(`products/${element}/subProducts`).listDocuments())
                        .then((doc) => {
                            doc.map((val) => {
                                return val.delete()
                            })
                        })
                        .catch((err) => console.log(`${err}`))
                })
            )
        })
    }

    return Promise.all(writePromises);

}

function deleteAllProducts(oldProducts: Array<String>){
    const writePromises: Promise<any>[] = [];
    oldProducts.forEach(element => {
        writePromises.push(firestore.doc(`products/${element}`).get().then((values) => {
            const ProductRoute = values.data().route
            return firestore.doc(`Catagories/${ProductRoute['Catagory']}/subCatagory/${ProductRoute['subCatagory']}/subSubCatagory/${ProductRoute['subSubCatagory']}`)
                .update({ Products: admin.firestore.FieldValue.arrayRemove(`${element}`) }).then(()=>{
                    const pathOfImagesDocument:String = values.data().pathOfImagesDocument;
                    return firebase_storage.bucket().deleteFiles({
                        prefix:`products/${pathOfImagesDocument}`,
                        force:true
                    })
                })
        })
            .then(() => {
                firestore.doc(`products/${element}`).delete()
                    .then(() =>
                        admin.firestore().collection(`products/${element}/subProducts`).listDocuments())
                    .then((doc) => {
                        doc.map((val) => {
                            return val.delete()
                        })
                    })
                    .catch((err) => console.log(`${err}`))
            })
        )
    });
    return Promise.all(writePromises);
}


function deleteAllUnpublishedProducts(oldProducts: Array<String>){
    const writePromises: Promise<any>[] = [];
    oldProducts.forEach(element => {
        writePromises.push(firestore.doc(`unpublishedProducts/${element}`).get()
        .then((values) => {
                    const pathOfImagesDocument:String = values.data().pathOfImagesDocument;
                    return firebase_storage.bucket().deleteFiles({
                        prefix:`products/${pathOfImagesDocument}`,
                        force:true
                    })
        })
            .then(() => {
                firestore.doc(`unpublishedProducts/${element}`).delete()
                    .then(() =>
                        admin.firestore().collection(`unpublishedProducts/${element}/subProducts`).listDocuments())
                    .then((doc) => {
                        doc.map((val) => {
                            return val.delete()
                        })
                    })
                    .catch((err) => console.log(`${err}`))
            })
        )
    });
    return Promise.all(writePromises);
}





export const onProductDelete = functions.firestore.document('vendors/{vendor}').onWrite((change, context) => {
    const writePromises: Promise<any>[] = [];
    if (change.after.exists && change.before.exists) {
        if("unpublishedProductsNames" in change.before.data() && "unpublishedProductsNames" in change.after.data()){
            const oldUnpublishedOldProducts:Array<String> = change.before.data().unpublishedProductsNames;
            const newUnpublishedOldProducts:Array<String> = change.after.data().unpublishedProductsNames;
            writePromises.push(deleteUnpublishedProductsCleanUp(oldUnpublishedOldProducts,newUnpublishedOldProducts));      
        }
        if("productNames" in change.before.data() && "productNames" in change.after.data()){
            const oldProducts: Array<String> = change.before.data().productNames;
            const newProducts: Array<String> = change.after.data().productNames;
            writePromises.push(deletePublishedProductsCleanUp(oldProducts,newProducts));
        }
        
    }
    else if (!change.after.exists && change.before.exists) {
        if("productNames" in  change.before.data()){
            writePromises.push(deleteAllProducts(change.before.data().productNames));
        }
        if("unpublishedProductsNames" in change.before.data()){
            writePromises.push(deleteAllUnpublishedProducts(change.before.data().unpublishedProductsNames));
        }
        
    }
    else if (change.after.exists && !change.before.exists) {
        writePromises.push(null)
    }
    else {
        writePromises.push(null)
    }
    return Promise.all(writePromises)
})


export const createReview_v1 = functions.https.onRequest((request, response) => {
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
    ).then(async () => {
        await firestore.collection('products').doc(`${productId}`).update({
            review: admin.firestore.FieldValue.arrayUnion(`${productId + userId}`),
        })
    }).then(async () => {
        await firestore.collection('users').doc(`${userId}`).update({
            reviews: admin.firestore.FieldValue.arrayUnion(`${productId + userId}`),
        })
        response.send('SUCCESS!');
    }).catch(e => {
        console.log(e);
        response.send(500);
    });
});

export const deletedProduct = functions.https.onRequest(async (request, response) => {
    const uid = request.query.uid;
    const productId = request.query.productId;
    const vendorRoute = firestore.doc(`vendors/${uid}`)
    if ((await vendorRoute.get()).exists) {
        if ((await vendorRoute.get()).data().productNames.includes(productId)) {
            return firestore.doc(`vendors/${uid}`).update({
                productNames: admin.firestore.FieldValue.arrayRemove(`${productId}`)
            }).then(() => response.send(`->>>`))
        }
        else {
            return response.send(`product doesn't exist`)
        }
    }
    else {
        return response.send(`vendor doesn't exist`)
    }
})

export const deleteSubProduct = functions.https.onRequest(async (request, response) => {
    const uid = request.query.uid;
    const productId = request.query.productId;
    const subProductId = request.query.subProductId;
    if ((await firestore.doc(`vendors/${uid}`).get()).exists) {

        if ((await firestore.doc(`products/${productId}/subProducts/${subProductId}`).get()).exists) {
            return firestore.doc(`products/${productId}/subProducts/${subProductId}`).update({
                amount: 0,
                hidden: true
            }).then(() => response.send(`->>>`))
        }
        else {
            return response.send(`product doesn't exist`)
        }
    }
    else {
        return response.send(`vendor doesn't exist`)
    }
})


export const buyProduct = functions.https.onRequest(async (request, response) => {
    const product = request.query.product;
    const subProduct = request.query.subProduct;
    const purchaseAmount = request.query.purchaseAmount
    const subProductroute = firestore.doc(`products/${product}/subProducts/${subProduct}`);
    const productRoute = firestore.doc(`products/${product}`)

    if ((await subProductroute.get()).exists) {
        return firestore.runTransaction((transaction) => {
            return transaction.getAll(subProductroute, productRoute).then((documentArray) => {

                const subProductAmount = documentArray[0].get('amount');
                const SoldProductAmount = documentArray[1].get('SoldAmount')
                if (parseInt(subProductAmount) >= purchaseAmount && parseInt(subProductAmount) > 0) {
                    transaction.set(subProductroute,
                        {
                            amount: subProductAmount - purchaseAmount
                        }, { merge: true })
                    transaction.set(productRoute, {
                        SoldAmount: (parseInt(SoldProductAmount) + parseInt(purchaseAmount)) * -1
                    }, { merge: true })
                }
                else if (parseInt(subProductAmount) <= purchaseAmount && parseInt(subProductAmount) > 0) {
                    throw new Error(
                        `Vendor does not have ${purchaseAmount} products of this type`
                    )
                }
                else {
                    throw new Error(`Vendor has sold out of this type of Product`)
                }
            })
        }).then(() => {
            console.log(`transaction is  succesful`)
            response.send('->>>')
        }).catch((err) => {
            console.log(`${err}`)
            response.send(`${err}`)
        })
    }
    else {
        response.send(`The Requested Product does not exist`)
    }
})


export const addProductToCart = functions.https.onRequest(async (request, response) => {

    const uid = request.query.uid;
    const product = request.query.product;
    const subProduct = request.query.subProduct;
    const amount = request.query.amount;
    const userExists = (await firestore.doc(`users/${uid}`).get()).exists;
    const productExists = (await firestore.doc(`products/${product}`).get()).exists
    const subProductRoute = firestore.doc(`products/${product}/subProducts/${subProduct}`)
    if (!userExists) {
        return response.send(`user doesn't exist`)
    }
    else if (!productExists) {
        return response.send(`product doesn't exist`)
    }
    else if (!(await subProductRoute.get()).exists) {
        return response.send(`subProduct doesn't exist`)
    }
    else if (!(await subProductRoute.get()).data().amount >= amount) {
        return response.send(`amount of requested product is unavailable`)
    }
    else {
        const route = `products/${product}/subProducts/${subProduct}`

        return firestore.doc(`users/${uid}/cart`).set({
            [route]: amount
        }, { merge: true }).then(() => {
            return response.send('->>>')
        })
            .catch((err) => {
                response.send(`${err}`)

            })
    }

});

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


    return Promise.all(writePromises).then(() => { response.send(`->>>`) });



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