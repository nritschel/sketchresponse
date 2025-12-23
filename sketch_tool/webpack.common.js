/* eslint-disable import/no-extraneous-dependencies */
const path = require('path');

module.exports = {
  entry: {
    application: './lib/main.js',
  },
  output: {
    path: path.resolve(__dirname, 'build/'),
    filename: '[name].min.js',
    chunkFilename: '[name].min.js',
    library: 'SketchInput',
  },
  resolve: {
    extensions: ['.js'],
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env'],
            },
          }
        ],
      },
      {
        test: /\.(ttf|eot|woff|woff2)$/,
        loader: 'ignore-loader',
      },
      {
        test: /\.svg$/,
        use: 'raw-loader',
      },
      {
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader',
        ],
      },
    ],
  },
  optimization: {
    splitChunks: {
      chunks: 'all',
      minSize: 1,
      cacheGroups: {
        vendors: {
            test: /.*/,
            name: 'sketchresponse',
        }
      },
    },
  },
};
