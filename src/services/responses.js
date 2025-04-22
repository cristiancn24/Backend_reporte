exports.success = function (req, res, items) {
    res.status(200).json({
        success: true,
        data: items
    });
}

exports.error = function (req, res, items) {
    res.status(200).json({
        success: false,
        data: items
    });
}