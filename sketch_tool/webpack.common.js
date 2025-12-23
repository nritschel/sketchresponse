/* eslint-disable import/no-extraneous-dependencies */
const path = require('path');

module.exports = {
  entry: {
    application: './lib/main.js',
  },
  output: {
    path: path.resolve(__dirname, 'dist/'),
    filename: 'sketchresponse.min.js',
    chunkFilename: 'sketchresponse-[name].min.js',
    library: 'sketchresponse',
    libraryTarget: 'umd',
    umdNamedDefine: true
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
};
