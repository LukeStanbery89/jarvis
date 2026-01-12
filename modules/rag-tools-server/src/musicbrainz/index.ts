import { MusicBrainzSearchFactory } from './factories/MusicBrainzSearchFactory';

// Create and export the default MusicBrainzSearch instance
const MusicBrainzSearch = MusicBrainzSearchFactory.create();

export default MusicBrainzSearch;
export * from './interfaces';
export * from './factories';
export * from './services';