import sharp from "sharp";

export async function uploadImg(image, folder) {
    const fileName = `${Date.now()}.jpeg`;
    let tempPath = '/images/' + (folder ? folder + '/' : '') + fileName;
    const path = 'public' + tempPath; // used for file system
    const url = process.env.URL + tempPath; // used for front end to load image

    const options = {
        width: null,
        height: 1200,
        fit: 'contain',
    }

    await sharp(image).resize(options).jpeg().toFile(path);

    return { url, path };
}