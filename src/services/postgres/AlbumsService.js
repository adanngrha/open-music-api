const { Pool } = require('pg');
const { nanoid } = require('nanoid');
const InvariantError = require('../../exceptions/InvariantError');
const NotFoundError = require('../../exceptions/NotFoundError');
const { mapDBToModelAlbums } = require('../../utils/albums');

class AlbumService {
  constructor(cacheService) {
    this._pool = new Pool();
    this._cacheService = cacheService;
  }

  async addAlbum({ name, year }) {
    const id = `album-${nanoid(16)}`;
    const createdAt = new Date().toISOString();
    const updatedAt = createdAt;

    const query = {
      text: 'INSERT INTO albums VALUES($1, $2, $3, $4, $5) RETURNING id',
      values: [id, name, year, createdAt, updatedAt],
    };

    const result = await this._pool.query(query);

    if (!result.rows[0].id) {
      throw new InvariantError('Album gagal ditambahkan!');
    }

    return result.rows[0].id;
  }

  async getAlbumById(id) {
    const albumQuery = {
      text: 'SELECT * FROM albums WHERE id = $1',
      values: [id],
    };
    const songsQuery = {
      text: 'SELECT id, title, performer FROM songs WHERE album_id = $1',
      values: [id],
    };

    const albumResult = await this._pool.query(albumQuery);
    const songsResult = await this._pool.query(songsQuery);

    if (!albumResult.rowCount) {
      throw new NotFoundError('Album tidak ditemukan');
    }

    if (!songsResult.rowCount) {
      songsResult.rows = null;
    }

    albumResult.rows[0].songs = songsResult.rows;

    return albumResult.rows.map(mapDBToModelAlbums)[0];
  }

  async editAlbumById(id, { name, year }) {
    const updatedAt = new Date().toISOString();
    const query = {
      text: 'UPDATE albums SET name = $1, year = $2, updated_at = $3 WHERE id = $4 RETURNING id',
      values: [name, year, updatedAt, id],
    };

    const result = await this._pool.query(query);

    if (!result.rowCount) {
      throw new NotFoundError('Gagal memperbarui album. Id tidak ditemukan');
    }
  }

  async deleteAlbumById(id) {
    const query = {
      text: 'DELETE FROM albums WHERE id = $1 RETURNING id',
      values: [id],
    };

    const result = await this._pool.query(query);

    if (!result.rowCount) {
      throw new NotFoundError('Album gagal dihapus. Id tidak ditemukan');
    }
  }

  async addAlbumCoverById(id, { coverUrl }) {
    const query = {
      text: 'UPDATE albums SET cover = $1 WHERE id = $2',
      values: [coverUrl, id],
    };

    const result = await this._pool.query(query);

    if (!result.rowCount) {
      throw new NotFoundError('Gagal menambahkan cover album. Id tidak ditemukan');
    }
  }

  async addlikeOrUnlikedAlbumById(userId, albumId) {
    const checkIfAlbumValid = {
      text: 'SELECT * FROM albums WHERE id = $1',
      values: [albumId],
    };

    const checkAlbum = await this._pool.query(checkIfAlbumValid);

    if (!checkAlbum.rowCount) {
      throw new NotFoundError('Gagal menyukai album. Album tidak ditemukan');
    }

    const checkIfAlbumAlreadyLiked = {
      text: 'SELECT * FROM user_album_likes WHERE user_id = $1 AND album_id = $2',
      values: [userId, albumId],
    };

    const checkResult = await this._pool.query(checkIfAlbumAlreadyLiked);

    if (!checkResult.rowCount) {
      const id = nanoid(16);

      const insertLike = {
        text: 'INSERT INTO user_album_likes VALUES($1, $2, $3)',
        values: [id, userId, albumId],
      };

      await this._pool.query(insertLike);
      await this._cacheService.delete(`likes:${albumId}`);

      return 'Berhasil menyukai album';
    }

    const deleteLike = {
      text: 'DELETE FROM user_album_likes WHERE user_id = $1 AND album_id = $2',
      values: [userId, albumId],
    };

    await this._pool.query(deleteLike);
    await this._cacheService.delete(`likes:${albumId}`);

    return 'Batal menyukai album';
  }

  async getAlbumLikesById(id) {
    try {
      // mendapatkan jumlah album likes dari cache
      let result = await this._cacheService.get(`likes:${id}`);
      result = JSON.parse(result);
      result.cache = true;

      return result;
    } catch (error) {
      const query = {
        text: 'SELECT * FROM user_album_likes WHERE album_id = $1',
        values: [id],
      };

      const result = await this._pool.query(query);

      // jumlah album likes akan disimpan pada cache sebelum fungsi getNotes dikembalikan
      result.condition = await this._cacheService.set(`likes:${id}`, JSON.stringify(result));
      result.cache = false;

      return result;
    }
  }
}

module.exports = AlbumService;
