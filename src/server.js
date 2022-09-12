require('dotenv').config();
const Hapi = require('@hapi/hapi');
const songs = require('./api/songs');
const albums = require('./api/albums');
const SongsService = require('./services/postgres/SongsService');
const AlbumsService = require('./services/postgres/AlbumsService');
const SongsValidator = require('./validator/songs');
const AlbumsValidator = require('./validator/albums');

const init = async () => {
    const server = Hapi.server({
        port: process.env.PORT,
        host: process.env.HOST,
        routes: {
            cors: {
                origin: ['*'],
            },
        },
    });

    await server.register({
        plugin: songs,
        options: {
            service: SongsService,
            validator: SongsValidator,
        },
    });

    await server.register({
        plugin: albums,
        options: {
            service: AlbumsService,
            validator: AlbumsValidator,
        },
    });

    await server.start();
    console.log(`Server running on ${server.info.uri}`);
};

init();