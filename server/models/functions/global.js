// replace cyrillic characters with latin
const alphabet = { "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ж": "j", "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f", "х": "h", "ц": "c", "ч": "ch", "ш": "sh", "щ": "sht", "ъ": "u", "ь": "y", "ю": "yu", "я": "ya" };

export function transliterate(word) {
    return word.split('').map(function (char) {
        return alphabet[char] || char;
    }).join("");
}

export function slugify(word) {
    return transliterate(word.toLowerCase().replace(/ /g, '-'));
}

export function sparseFix(schema, field) {
    /*
    This function fixes the sparse indexing
    By default, saving/updating as empty string in unique fields will throw error on the index
    This fixes it by settings the value as undefined, thus removing the field completely before saving
    */

    schema.pre('save', function (next) {
        if (this[field] === '')
            this[field] = undefined;

        next();
    });

    schema.pre('update', function (next) {
        const modifiedField = this.getUpdate().$set[field];

        if (!modifiedField)
            return next();

        try {
            this.getUpdate().$set[field] = undefined;
            next();
        } catch (error) {
            return next(error);
        }
    });

    schema.pre('updateOne', function (next) {
        const modifiedField = this._update[field];
        if (modifiedField !== '')
            return next();

        try {
            // Buggy, currently if there was an old value and now we want to set it to an empty string, it doesnt update it and skips over it
            this._update[field] = undefined;
            next();
        } catch (error) {
            return next(error);
        }
    })
}