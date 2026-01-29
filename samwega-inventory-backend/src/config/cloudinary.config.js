const cloudinary = require('cloudinary').v2;
const config = require('./environment');

/**
 * Initialize Cloudinary
 */
const initializeCloudinary = () => {
    try {
        cloudinary.config({
            cloud_name: config.CLOUDINARY.CLOUD_NAME,
            api_key: config.CLOUDINARY.API_KEY,
            api_secret: config.CLOUDINARY.API_SECRET
        });

        console.log('✅ Cloudinary initialized successfully');
        console.log(`   - Cloud Name: ${config.CLOUDINARY.CLOUD_NAME || 'NOT SET'}`);
    } catch (error) {
        console.error('❌ Cloudinary initialization error:', error.message);
    }
};

/**
 * Upload file to Cloudinary
 * @param {string} filePath - Path to file or base64 string
 * @param {Object} options - Upload options
 * @returns {Promise<Object>}
 */
const uploadFile = async (filePath, options = {}) => {
    try {
        const defaultOptions = {
            folder: 'samwega',
            resource_type: 'auto',
            ...options
        };

        const result = await cloudinary.uploader.upload(filePath, defaultOptions);
        console.log(`✅ File uploaded to Cloudinary: ${result.secure_url}`);
        return result;
    } catch (error) {
        console.error('❌ Cloudinary upload error:', error.message);
        throw error;
    }
};

/**
 * Upload PDF report to Cloudinary
 * @param {Buffer} pdfBuffer - PDF buffer
 * @param {string} fileName - File name
 * @returns {Promise<Object>}
 */
const uploadPDF = async (pdfBuffer, fileName) => {
    try {
        const base64PDF = `data:application/pdf;base64,${pdfBuffer.toString('base64')}`;

        const result = await cloudinary.uploader.upload(base64PDF, {
            folder: 'samwega-reports',
            resource_type: 'raw',
            public_id: fileName,
            format: 'pdf'
        });

        console.log(`✅ PDF uploaded to Cloudinary: ${result.secure_url}`);
        return result;
    } catch (error) {
        console.error('❌ PDF upload error:', error.message);
        throw error;
    }
};

/**
 * Delete file from Cloudinary
 * @param {string} publicId - Public ID of the file
 * @param {string} resourceType - Resource type (image, video, raw)
 * @returns {Promise<Object>}
 */
const deleteFile = async (publicId, resourceType = 'image') => {
    try {
        const result = await cloudinary.uploader.destroy(publicId, {
            resource_type: resourceType
        });
        console.log(`✅ File deleted from Cloudinary: ${publicId}`);
        return result;
    } catch (error) {
        console.error('❌ Cloudinary delete error:', error.message);
        throw error;
    }
};

module.exports = {
    initializeCloudinary,
    uploadFile,
    uploadPDF,
    deleteFile,
    cloudinary
};
