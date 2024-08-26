import sharp from "sharp";

export async function uploadImg(image) {
    const fileName = `${Date.now()}.jpeg`;
    const path = `public/images/${fileName}`;
    const options = {
        width: null,
        height: 1200,
        fit: 'contain',
    }

    await sharp(image).resize(options).jpeg().toFile(path);

    return `/images/${fileName}`;
}