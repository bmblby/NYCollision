const path = require('path');
const webpack = require('webpack');
// const CleanWebpackPlugin = require('clean-webpack-plugin');
const WriteFilePlugin = require('write-file-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin')

// Module for the index.html
module.exports = [{
    mode: 'development',
    target: 'web',
    entry: {
      // 'webpack-hot-middleware/client',
      app: './src/js/app.js'
    },
    devtool: "inline-source-map",
    devServer: {
      contentBase: path.resolve(__dirname, 'dist')
    },
    output: {
      // publicPath: '/',
      path: path.resolve(__dirname, 'dist'),
      filename: 'bundle.js'
    },
    module: {
      rules: [{
          test: /\.css$/,
          use: ['style-loader', 'css-loader']
        },
        {
          test: /\.(png|jpeg)$/,
          loader: 'file-loader'
        }
      ]
    },
    plugins: [
      // new CleanWebpackPlugin(['dist']),
      new WriteFilePlugin(),
      new CopyWebpackPlugin([
        {
          from: 'src/*.html',
          to: '',
          flatten: true
        }
      ], {
        copyUnmodified: false
      })
    ]
}, ];
