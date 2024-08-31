import sharp from "sharp";
import multer from "multer";

const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png')
        cb(null, true);
    else
        cb(new Error('Only jpeg and png files are allowed!'));
}

export const imageUploader = multer({
    storage,
    fileFilter
});

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