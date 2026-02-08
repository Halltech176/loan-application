require('dotenv').config();

module.exports = {
  mongodb: {
    url: process.env.MONGODB_URI || 'mongodb://localhost:27017',
    databaseName: 'loan-platform',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  },
  migrationsDir: 'migrations',
  changelogCollectionName: 'changelog',
  migrationFileExtension: '.js',
  useFileHash: false,
  moduleSystem: 'commonjs',
};
