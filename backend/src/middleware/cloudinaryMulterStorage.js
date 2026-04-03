'use strict';

/**
 * Multer storage engine for Cloudinary v2 (upload_stream).
 * Replaces multer-storage-cloudinary, which only declares a cloudinary@^1 peer
 * and blocks npm ci with cloudinary@^2.
 *
 * API matches multer-storage-cloudinary's CloudinaryStorage for the options we use.
 */
class CloudinaryStorage {
  constructor(opts) {
    if (opts == null || opts.cloudinary == null) {
      throw new Error('`cloudinary` option required');
    }
    this.cloudinary = opts.cloudinary;
    this.params = opts.params != null ? opts.params : {};
  }

  _handleFile(req, file, callback) {
    (async () => {
      try {
        let uploadOptions;
        if (typeof this.params === 'function') {
          uploadOptions = await this.params(req, file);
        } else {
          const { public_id: publicId, ...otherParams } = this.params;
          uploadOptions = {};
          if (publicId != null) {
            uploadOptions.public_id =
              typeof publicId === 'function' ? await publicId(req, file) : publicId;
          }
          for (const key of Object.keys(otherParams)) {
            const getterOrValue = otherParams[key];
            uploadOptions[key] =
              typeof getterOrValue === 'function'
                ? await getterOrValue(req, file)
                : getterOrValue;
          }
        }

        const resp = await new Promise((resolve, reject) => {
          const stream = this.cloudinary.uploader.upload_stream(
            uploadOptions,
            (err, response) => {
              if (err != null) return reject(err);
              resolve(response);
            }
          );
          file.stream.pipe(stream);
        });

        callback(undefined, {
          path: resp.secure_url,
          size: resp.bytes,
          filename: resp.public_id,
        });
      } catch (err) {
        callback(err);
      }
    })();
  }

  _removeFile(req, file, callback) {
    this.cloudinary.uploader.destroy(file.filename, { invalidate: true }, callback);
  }
}

module.exports = { CloudinaryStorage };
