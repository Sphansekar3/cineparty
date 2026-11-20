import type { Movie } from '../types';
import { searchMoviesCinemeta } from './torrentSearchService';

// Curated popular & classic movies with verified TMDB & IMDB IDs so the app works instantly with 0 setup
export const CURATED_MOVIES: Movie[] = [
  {
    id: 157336,
    tmdbId: 157336,
    imdbId: 'tt0816692',
    title: 'Interstellar',
    overview: 'The adventures of a group of explorers who make use of a newly discovered wormhole to surpass the limitations on human space travel and conquer the vast distances involved in an interstellar voyage.',
    releaseDate: '2014-11-05',
    voteAverage: 8.4,
    posterPath: 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/xJHokMbljvjADYdit5fK5VQsXEG.jpg',
    streamType: 'webtorrent',
  },
  {
    id: 27205,
    tmdbId: 27205,
    imdbId: 'tt1375666',
    title: 'Inception',
    overview: 'Cobb, a skilled thief who commits corporate espionage by infiltrating the subconscious of his targets, is offered a chance to regain his old life as payment for a task considered to be impossible: "inception", the implantation of another person\'s idea into a target\'s subconscious.',
    releaseDate: '2010-07-15',
    voteAverage: 8.4,
    posterPath: 'https://image.tmdb.org/t/p/w500/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/8ZTVqvKDQ8emSGUEMjsS4yHAwrp.jpg',
    streamType: 'webtorrent',
  },
  {
    id: 155,
    tmdbId: 155,
    imdbId: 'tt0468569',
    title: 'The Dark Knight',
    overview: 'Batman raises the stakes in his war on crime. With the help of allies Lt. Jim Gordon and DA Harvey Dent, Batman sets out to dismantle the remaining criminal organizations that plague the streets.',
    releaseDate: '2008-07-16',
    voteAverage: 8.5,
    posterPath: 'https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/dqK9Hag1054tghRQSqLSfrkvQnA.jpg',
    streamType: 'webtorrent',
  },
  {
    id: 438631,
    tmdbId: 438631,
    imdbId: 'tt1160419',
    title: 'Dune',
    overview: "Paul Atreides, a brilliant and gifted young man born into a great destiny beyond his understanding, must travel to the most dangerous planet in the universe to ensure the future of his family and his people.",
    releaseDate: '2021-09-15',
    voteAverage: 7.8,
    posterPath: 'https://image.tmdb.org/t/p/w500/d5NXSklXo0qyIYkgV94XAgMIckC.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/lzWHmYdfeFiMIY4JaMmtR7GEli3.jpg',
    streamType: 'webtorrent',
  },
  {
    id: 299534,
    tmdbId: 299534,
    imdbId: 'tt4154796',
    title: 'Avengers: Endgame',
    overview: 'After the devastating events of Avengers: Infinity War, the universe is in ruins due to the efforts of the Mad Titan, Thanos. With the help of remaining allies, the Avengers must assemble once more in order to undo Thanos\' actions and restore order to the universe.',
    releaseDate: '2019-04-24',
    voteAverage: 8.3,
    posterPath: 'https://image.tmdb.org/t/p/w500/or06FN3Dka5tukK1e9sl16pB3iy.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/7RyHsO4yDXtBv1zUU3mTpHeQ0d5.jpg',
    streamType: 'webtorrent',
  },
  {
    id: 569094,
    tmdbId: 569094,
    imdbId: 'tt9362722',
    title: 'Spider-Man: Across the Spider-Verse',
    overview: 'Miles Morales catapults across the Multiverse, where he encounters a team of Spider-People charged with protecting its very existence. When the heroes clash on how to handle a new threat, Miles must redefine what it means to be a hero.',
    releaseDate: '2023-05-31',
    voteAverage: 8.4,
    posterPath: 'https://image.tmdb.org/t/p/w500/8Vt6mWEReuy4Of61Lnj5Xj704m8.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/4HodYYKEIsGOdinkGi2Ucz6X9i0.jpg',
    streamType: 'webtorrent',
  },
  {
    id: 872585,
    tmdbId: 872585,
    imdbId: 'tt15398776',
    title: 'Oppenheimer',
    overview: "The story of J. Robert Oppenheimer's role in the development of the atomic bomb during World War II.",
    releaseDate: '2023-07-19',
    voteAverage: 8.1,
    posterPath: 'https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/fm6KqXpk3M2HVveHwCrBSSBaO0V.jpg',
    streamType: 'webtorrent',
  },
  {
    id: 693134,
    tmdbId: 693134,
    imdbId: 'tt15239678',
    title: 'Dune: Part Two',
    overview: 'Follow the mythic journey of Paul Atreides as he unites with Chani and the Fremen while on a path of revenge against the conspirators who destroyed his family.',
    releaseDate: '2024-02-27',
    voteAverage: 8.2,
    posterPath: 'https://image.tmdb.org/t/p/w500/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/xOMo8BRK7PfcJv9JCnx7s520b4q.jpg',
    streamType: 'webtorrent',
  },
  {
    id: 19995,
    tmdbId: 19995,
    imdbId: 'tt0499549',
    title: 'Avatar',
    overview: 'In the 22nd century, a paraplegic Marine is dispatched to the moon Pandora on a unique mission, but becomes torn between following orders and protecting an alien civilization.',
    releaseDate: '2009-12-15',
    voteAverage: 7.6,
    posterPath: 'https://image.tmdb.org/t/p/w500/kyeqWdyUXW608qlYkRqosgbbn0b.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/vL5LR6WdxWPjC3z4yFku44qBhu5.jpg',
    streamType: 'webtorrent',
  },
  {
    id: 550,
    tmdbId: 550,
    imdbId: 'tt0137523',
    title: 'Fight Club',
    overview: 'A ticking-time-bomb insomniac and a slippery soap salesman channel primal male aggression into a shocking new form of therapy.',
    releaseDate: '1999-10-15',
    voteAverage: 8.4,
    posterPath: 'https://image.tmdb.org/t/p/w500/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/hZkgoQYus5vegHoetLkCJzb17zJ.jpg',
    streamType: 'webtorrent',
  },
  {
    id: 999901,
    title: 'Big Buck Bunny (WebTorrent P2P)',
    overview: 'A large and lovable rabbit deals with bullying forest creatures in this classic open-source animated short. Streams via WebTorrent P2P with 100% synchronized controls!',
    releaseDate: '2008-04-10',
    voteAverage: 7.2,
    posterPath: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=500&auto=format&fit=crop&q=80',
    backdropPath: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=1200&auto=format&fit=crop&q=80',
    streamType: 'webtorrent',
    streamUrl: 'https://webtorrent.io/torrents/big-buck-bunny.torrent',
  },
  {
    id: 999902,
    title: 'Sintel (WebTorrent P2P)',
    overview: 'The open-movie fantasy short following a lonely young woman who rescues and bonds with a baby dragon. Streams via WebTorrent P2P with 100% synchronized controls!',
    releaseDate: '2010-09-27',
    voteAverage: 7.5,
    posterPath: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=500&auto=format&fit=crop&q=80',
    backdropPath: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1200&auto=format&fit=crop&q=80',
    streamType: 'webtorrent',
    streamUrl: 'https://webtorrent.io/torrents/sintel.torrent',
  }
];

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/';

export async function searchMovies(query: string, apiKey?: string): Promise<Movie[]> {
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) return CURATED_MOVIES;

  // 1. If user provides a TMDB API key, fetch real-time from TMDB API
  if (apiKey) {
    try {
      const res = await fetch(
        `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(cleanQuery)}&include_adult=false`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.results && data.results.length > 0) {
          return data.results.map((item: any) => ({
            id: item.id,
            tmdbId: item.id,
            title: item.title,
            overview: item.overview,
            releaseDate: item.release_date,
            voteAverage: item.vote_average,
            posterPath: item.poster_path ? `${TMDB_IMAGE_BASE}w500${item.poster_path}` : undefined,
            backdropPath: item.backdrop_path ? `${TMDB_IMAGE_BASE}original${item.backdrop_path}` : undefined,
            streamType: 'webtorrent',
          }));
        }
      }
    } catch (err) {
      console.warn('TMDB API fetch failed, falling back to Cinemeta & local search', err);
    }
  }

  // 2. Query Cinemeta catalog (free, no API key, millions of movies with IMDB IDs)
  try {
    const cinemetaResults = await searchMoviesCinemeta(cleanQuery);
    if (cinemetaResults.length > 0) {
      // Find any curated movies that match query to place them on top
      const matchedCurated = CURATED_MOVIES.filter(
        (m) =>
          m.title.toLowerCase().includes(cleanQuery) ||
          (m.overview && m.overview.toLowerCase().includes(cleanQuery))
      );

      const existingIds = new Set(matchedCurated.map((m) => String(m.imdbId || m.id)));
      const filteredCinemeta = cinemetaResults.filter(
        (m) => !existingIds.has(String(m.imdbId || m.id))
      );

      return [...matchedCurated, ...filteredCinemeta];
    }
  } catch (err) {
    console.warn('Cinemeta search failed:', err);
  }

  // 3. Fallback to local curated search
  return CURATED_MOVIES.filter(
    (m) =>
      m.title.toLowerCase().includes(cleanQuery) ||
      (m.overview && m.overview.toLowerCase().includes(cleanQuery))
  );
}
