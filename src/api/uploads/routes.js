const path = require('path');

const routes = (handler) => [
  {
    method: 'POST',
    path: '/albums/{id}/covers',
    handler: handler.postAlbumCoverHandler,
    options: {
      payload: {
        allow: 'multipart/form-data',
        multipart: true,
        output: 'stream',
        maxBytes: 512000, // 500KB
      },
    },
  },
  {
    method: 'GET',
    path: '/uploads/albums/cover/{param*}',
    handler: {
      directory: {
        path: path.resolve(__dirname, 'albums/cover'),
      },
    },
  },
];

module.exports = routes;
