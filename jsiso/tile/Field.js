/*  Copyright (c) 2014 Iain Hamilton

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE. */

define([
  'jsiso/particles/EffectLoader',
  'jsiso/utils'
],

function(EffectLoader, utils) {
  return function(ctx, mapWidth, mapHeight, mapLayout) {

    var title = "";
    var zeroIsBlank = false;
    var stackTiles = false;
    var stackTileGraphic = null;
    var drawX = 0;
    var drawY = 0;

    var tileHeight = 0;
    var tileWidth = 0;

    var heightMap = null;
    var lightMap = null;
    var lightX = null;
    var lightY = null;

    var heightOffset = 0;
    var heightShadows = null;
    var shadowSettings = null;

    var shadowDistance = null;

    var heightMapOnTop = false;

    var curZoom = 1;
    var mouseUsed = false;
    var applyInteractions = false;
    var focusTilePosX = 0;
    var focusTilePosY = 0;

    var alphaWhenFocusBehind =  {}; // Used for applying alpha to objects infront of focus 

    var tilesHide = null;
    var hideSettings = null;

    var particleTiles =null;
    var particleMap = [];
    var particleMapHolder = [];

    var isometric = true;

    function _setup(settings) {
      tileWidth = settings.tileWidth;
      tileHeight = settings.tileHeight;
      lightMap = settings.lightMap;
      shadowDistance = settings.shadowDistance;
      title = settings.title;
      zeroIsBlank = settings.zeroIsBlank;
      applyInteractions = settings.applyInteractions;

      if (settings.particleMap) {
        _particleTiles(settings.particleMap);
      }
      
      mapLayout = settings.layout;

      if (settings.graphics) {
        tileImages = settings.graphics;
      }
      if (settings.graphicsDictionary) {
        tileImagesDictionary = settings.graphicsDictionary;
      }
      if (settings.isometric !== undefined) {
        isometric = settings.isometric;
      }

      if (settings.shadow) {
        _applyHeightShadow(true, settings.shadow);
      }

      if (settings.heightMap) {
        _stackTiles(settings.heightMap);
      }
      
      if (settings.width) {
        var row = [];
        var col = 0;
        mapLayout = [];
        for (var i = 0; i < settings.layout.length; i++) {
          col ++;
          if (col !== settings.width) {
            row.push(settings.layout[i]);
          }
          else {
            row.push(settings.layout[i]);
            mapLayout.push(row);
            row = [];
            col = 0;

          }
        }
      }
      
      alphaWhenFocusBehind = settings.alphaWhenFocusBehind;
    }

    function _draw(i, j, tileImageOverwite) {

      var xpos, ypos;
      i = Math.round(i);
      j = Math.round(j);
      if (i < 0) { i = 0; }
      if (j < 0) { j = 0; }
      if (i > mapLayout.length - 1) {
        i = mapLayout.length - 1;
      }
      if (mapLayout[i] && j > mapLayout[i].length - 1) {
        j = mapLayout[i].length - 1;
      }
      var resizedTileHeight;
      var stackGraphic = null;

      var graphicValue = (mapLayout[i] ? mapLayout[i][j] : 0);
      var distanceLighting = null;
      var distanceLightingSettings;
      var k = 0;

      var stack = 0;
      if (heightMap) {
        stack = Math.round(Number(heightMap[i][j]));
        k = stack;
      }

      if (shadowDistance) {
        distanceLightingSettings = {
          distance: shadowDistance.distance,
          darkness: shadowDistance.darkness,
          color: shadowDistance.color
        };
        distanceLighting = Math.sqrt((Math.round(i - lightX) * Math.round(i - lightX)) + (Math.round(j - lightY) * Math.round(j - lightY)));
        if (lightMap) {
          var lightDist = 0;
          // Calculate which light source is closest
          lightMap.map(function(light) {
            lightDist = Math.sqrt((Math.round(i - light[0]) * Math.round(i - light[0])) + (Math.round(j - light[1]) * Math.round(j - light[1])));
              if(distanceLighting / (distanceLightingSettings.darkness * distanceLightingSettings.distance) > lightDist / (light[2] * light[3])) {
                distanceLighting = lightDist;
                distanceLightingSettings.distance = light[2];
                distanceLightingSettings.darkness = light[3];
              }
          });
        }
        if(distanceLighting > distanceLightingSettings.distance){
          distanceLighting = distanceLightingSettings.distance;
        }
        distanceLighting =  distanceLighting / (distanceLightingSettings.darkness * distanceLightingSettings.distance);
      }
      if ((!zeroIsBlank) || (zeroIsBlank && graphicValue) || tileImageOverwite) {
        if (zeroIsBlank) {
          if (Number(graphicValue) >= 0) {
            graphicValue--;
          }
        }
        if(tilesHide && graphicValue >= hideSettings.hideStart && graphicValue <= hideSettings.hideEnd) {
          stackGraphic = tileImages[hideSettings.planeGraphic];
        }
        else if(tileImageOverwite) {
          stackGraphic = tileImageOverwite;
        }
        else {
          if (stackTileGraphic) {
            stackGraphic = stackTileGraphic;
          }
          else {
            if (Number(graphicValue) >= 0) {
              stackGraphic = tileImages[tileImagesDictionary[graphicValue]];
            }
            else {
              stackGraphic = undefined;
            }
          }
        }
        
        resizedTileHeight = 0;
        if (stackGraphic) {
          resizedTileHeight =  stackGraphic.height / (stackGraphic.width / tileWidth);
        }
        if (!isometric) {
          xpos = i * (tileHeight * curZoom) + drawX;
          ypos = j * (tileWidth  * curZoom) + drawY;
        }
        else {
          xpos = (i - j) * (tileHeight * curZoom) + drawX;
          ypos = (i + j) * (tileWidth / 4 * curZoom) + drawY;
        }

        if (!stackTiles) {

          // If no heightmap for this tile

          if (!distanceLightingSettings || ( distanceLightingSettings && distanceLighting < distanceLightingSettings.darkness)) {
            if (tileImageOverwite) {

              // Draw the overwriting image insetad of tile

              ctx.drawImage(tileImageOverwite, 0, 0, stackGraphic.width, stackGraphic.height, xpos, (ypos + ((tileHeight - resizedTileHeight) * curZoom)), (tileWidth * curZoom), (resizedTileHeight * curZoom));
            }
            else {

              // Draw the tile image
              ctx.save();
              if (alphaWhenFocusBehind && alphaWhenFocusBehind.apply === true) {
                if ((i === focusTilePosX + 1 && j === focusTilePosY + 1) || (i === focusTilePosX && j === focusTilePosY + 1) || (i === focusTilePosX + 1 && j === focusTilePosY)) {
                  if (alphaWhenFocusBehind.objectApplied && ((alphaWhenFocusBehind.objectApplied === null || alphaWhenFocusBehind.objectApplied && (resizedTileHeight * curZoom) > alphaWhenFocusBehind.objectApplied.height * curZoom))) {
                    ctx.globalAlpha = 0.6;
                  }
                }
              }

              if (Number(graphicValue) >= 0) {
                // tile has a graphic ID

                ctx.drawImage(stackGraphic, 0, 0, stackGraphic.width, stackGraphic.height, xpos, (ypos + ((tileHeight - resizedTileHeight) * curZoom)), (tileWidth * curZoom), (resizedTileHeight * curZoom));
              
              }
              else if (graphicValue != -1) {
                // tile is an RGBA value

                if (!isometric) {
                  ctx.fillStyle = 'rgba' + graphicValue;
                  ctx.beginPath();
                  ctx.moveTo(xpos, ypos);
                  ctx.lineTo(xpos + (tileWidth * curZoom), ypos);
                  ctx.lineTo(xpos + (tileWidth * curZoom), ypos + (tileHeight * curZoom));
                  ctx.lineTo(xpos, ypos + (tileHeight * curZoom));
                  ctx.fill();
                }
                else {
                  ctx.fillStyle = 'rgba' + graphicValue;
                  ctx.beginPath();
                  ctx.moveTo(xpos, ypos + ((k -1) * ((tileHeight - resizedTileHeight) * curZoom)) + (tileHeight * curZoom) / 2);
                  ctx.lineTo(xpos + (tileHeight * curZoom), ypos + ((k -1) * ((tileHeight - resizedTileHeight) * curZoom)));
                  ctx.lineTo(xpos + (tileHeight * curZoom) * 2, ypos + ((k -1) * ((tileHeight - resizedTileHeight) * curZoom)) + (tileHeight * curZoom) / 2);
                  ctx.lineTo(xpos + (tileHeight * curZoom), ypos + ((k -1) * ((tileHeight - resizedTileHeight) * curZoom)) + (tileHeight * curZoom));
                  ctx.fill();
                }
              }

              ctx.restore();
            }
          }
        }
        else {
          
          if (heightMapOnTop) {

            // If tile is to be placed on top of heightmap 

            if (!distanceLightingSettings || ( distanceLightingSettings && distanceLighting < distanceLightingSettings.darkness)) {
              if (tileImageOverwite) {

                // Draw overwriting image on top of height map
                  
                ctx.drawImage(tileImageOverwite, 0, 0, tileImageOverwite.width, tileImageOverwite.height, xpos, ypos + ((stack - 1) *(tileHeight - heightOffset - tileHeight)) * curZoom - (resizedTileHeight  - tileHeight) * curZoom, (tileWidth * curZoom), (resizedTileHeight * curZoom));
              }
              else {

                // Draw the tile image on top of height map

                if (Number(graphicValue) >= 0) {

                  ctx.save();
                  if (alphaWhenFocusBehind && alphaWhenFocusBehind.apply === true) {
                    if ((i === focusTilePosX + 1 && j === focusTilePosY + 1) || (i === focusTilePosX && j === focusTilePosY + 1) || (i === focusTilePosX + 1 && j === focusTilePosY)) {
                      if (alphaWhenFocusBehind.objectApplied && (alphaWhenFocusBehind.objectApplied === null || (alphaWhenFocusBehind.objectApplied && (resizedTileHeight * curZoom) > alphaWhenFocusBehind.objectApplied.height * curZoom))) {
                        ctx.globalAlpha = 0.6;
                      }
                    }
                  }
                  ctx.drawImage(stackGraphic, 0, 0, stackGraphic.width, stackGraphic.height, xpos, ypos + ((stack - 1) * (tileHeight - heightOffset - tileHeight)) * curZoom - (resizedTileHeight  - tileHeight) * curZoom, (tileWidth * curZoom), (resizedTileHeight * curZoom));
                  ctx.restore();
                }
                else if (graphicValue != -1) {
                  if (!isometric) {
                    ctx.fillStyle = 'rgba' + graphicValue;
                    ctx.beginPath();
                    ctx.moveTo(xpos, ypos);
                    ctx.lineTo(xpos + (tileWidth * curZoom), ypos);
                    ctx.lineTo(xpos + (tileWidth * curZoom), ypos + (tileHeight * curZoom));
                    ctx.lineTo(xpos, ypos + (tileHeight * curZoom));
                    ctx.fill();
                  }
                  else {
                    ctx.fillStyle = 'rgba' + graphicValue;
                    ctx.beginPath();
                    ctx.moveTo(xpos, ypos - ((stack -1) * ((tileHeight - resizedTileHeight) * curZoom)) + (tileHeight * curZoom) / 2);
                    ctx.lineTo(xpos + (tileHeight * curZoom), ypos - ((stack -1) * ((tileHeight - resizedTileHeight) * curZoom)));
                    ctx.lineTo(xpos + (tileHeight * curZoom) * 2, ypos - ((stack -1) * ((tileHeight - resizedTileHeight) * curZoom)) + (tileHeight * curZoom) / 2);
                    ctx.lineTo(xpos + (tileHeight * curZoom), ypos - ((stack -1) * ((tileHeight - resizedTileHeight) * curZoom)) + (tileHeight * curZoom));
                    ctx.fill();
                  }
                }
              }
            }
          }
          else {

            // If tile is to be repeated for heightmap

            for (k = 0; k <= stack; k++) {

              if (!distanceLightingSettings || ( distanceLightingSettings && distanceLighting < distanceLightingSettings.darkness)) {
                if (tileImageOverwite) {

                  // If there is an overwrite image

                  ctx.drawImage(tileImageOverwite, 0, 0, tileImageOverwite.width, tileImageOverwite.height, xpos, ypos + (k * ((tileHeight - heightOffset - resizedTileHeight) * curZoom)), (tileWidth * curZoom), (resizedTileHeight * curZoom));
                }
                else{
                  if (stackTileGraphic) {
                    if (k !== stack) {

                      // Repeat tile graphic till it's reach heightmap max
                      if (stackGraphic) {
                        ctx.drawImage(stackGraphic, 0, 0, stackGraphic.width, stackGraphic.height, xpos, ypos + (k * ((tileHeight - heightOffset - resizedTileHeight) * curZoom)), (tileWidth * curZoom), (resizedTileHeight * curZoom));
                      }

                    }
                    else {

                      if (Number(graphicValue) >= 0) {
                        // reset stackGraphic

                        stackGraphic = tileImages[tileImagesDictionary[graphicValue]];
                        ctx.drawImage(stackGraphic, 0, 0, stackGraphic.width, stackGraphic.height, xpos, ypos + ((k - 1) * ((tileHeight - heightOffset - resizedTileHeight) * curZoom)), (tileWidth * curZoom), (stackGraphic.height / (stackGraphic.width / tileWidth) * curZoom));
                      }
                      else if (graphicValue != -1) {
                        ctx.fillStyle = 'rgba' + graphicValue;
                        ctx.beginPath();
                        ctx.moveTo(xpos, ypos + ((k -1) * ((tileHeight - resizedTileHeight) * curZoom)) + (tileHeight * curZoom) / 2);
                        ctx.lineTo(xpos + (tileHeight * curZoom), ypos + ((k -1) * ((tileHeight - resizedTileHeight) * curZoom)));
                        ctx.lineTo(xpos + (tileHeight * curZoom) * 2, ypos + ((k -1) * ((tileHeight - resizedTileHeight) * curZoom)) + (tileHeight * curZoom) / 2);
                        ctx.lineTo(xpos + (tileHeight * curZoom), ypos + ((k -1) * ((tileHeight - resizedTileHeight) * curZoom)) + (tileHeight * curZoom));
                        ctx.fill();
                      }

                    }
                  }
                  else {

                    // No stack graphic specified so draw tile at top
                    if (k === stack) {
                      if (Number(graphicValue) >= 0) {
                        ctx.drawImage(stackGraphic, 0, 0, stackGraphic.width, stackGraphic.height, xpos, ypos + (k * ((tileHeight - heightOffset - resizedTileHeight) * curZoom)), (tileWidth * curZoom), (resizedTileHeight * curZoom));
                      }
                      else if (graphicValue != -1) {
                        ctx.fillStyle = 'rgba' + graphicValue;
                        ctx.beginPath();
                        ctx.moveTo(xpos, ypos - ((stack -1) * ((tileHeight - resizedTileHeight) * curZoom)) + (tileHeight * curZoom) / 2);
                        ctx.lineTo(xpos + (tileHeight * curZoom), ypos - ((stack -1) * ((tileHeight - resizedTileHeight) * curZoom)));
                        ctx.lineTo(xpos + (tileHeight * curZoom) * 2, ypos - ((stack -1) * ((tileHeight - resizedTileHeight) * curZoom)) + (tileHeight * curZoom) / 2);
                        ctx.lineTo(xpos + (tileHeight * curZoom), ypos - ((stack -1) * ((tileHeight - resizedTileHeight) * curZoom)) + (tileHeight * curZoom));
                        ctx.fill();
                      }
                    }
                    else {
                      ctx.drawImage(stackGraphic, 0, 0, stackGraphic.width, stackGraphic.height, xpos, ypos + (k * ((tileHeight - heightOffset - resizedTileHeight) * curZoom)), (tileWidth * curZoom), (resizedTileHeight * curZoom));
                    }
                  }
                }
              }
            }
            ctx.restore();
          }
        }
      }
      if (particleTiles) {

        // Draw Particles
        if (!distanceLightingSettings || ( distanceLightingSettings && distanceLighting < distanceLightingSettings.darkness)) {
          if (particleMap[i] && particleMap[i][j] !== undefined && Number(particleMap[i][j]) !== 0) {
            if (!particleMapHolder[i]) {
              particleMapHolder[i] = [];
            }
            if (!particleMapHolder[i][j]) {
              particleMapHolder[i][j] = new EffectLoader().getEffect(particleMap[i][j], ctx, utils.range(0, mapHeight), utils.range(0, mapWidth));
            }
            particleMapHolder[i][j].Draw(xpos, ypos + ((k - 1) * (tileHeight - heightOffset - tileHeight)) * curZoom - (resizedTileHeight  - tileHeight) * curZoom, curZoom);
          }
        }
      }

      if (heightShadows) {
        var nextStack = 0;
        var currStack = 0;
        var shadowXpos = 0;
        var shadowYpos = 0;

        if (heightMap) {
          nextStack = Math.round(Number(heightMap[i][j - 1]));
          currStack = Math.round(Number(heightMap[i][j]));
          if (currStack < nextStack) {
            shadowXpos = (i - j) * (tileHeight * curZoom) + drawX;
            shadowYpos = (i + j) * (tileWidth / 4 * curZoom) + drawY;
            if (shadowSettings.verticalColor) {

              // Apply Vertical shadow created from stacked tiles

              if (!distanceLightingSettings  || (distanceLighting < distanceLightingSettings.darkness)) {
                ctx.fillStyle = 'rgba' + (typeof shadowSettings.verticalColor === 'string' ? shadowSettings.verticalColor : shadowSettings.verticalColor[i][j]);
                ctx.beginPath();
                ctx.moveTo(shadowXpos, shadowYpos + ((currStack - 1) * ((tileHeight - resizedTileHeight) * curZoom)) + (tileHeight * curZoom) / 2);
                ctx.lineTo(shadowXpos + (tileHeight * curZoom), shadowYpos + ((currStack - 1) * ((tileHeight - resizedTileHeight) * curZoom)));
                ctx.lineTo(shadowXpos + (tileHeight * curZoom) * 2, shadowYpos + ((currStack - 1) * ((tileHeight - resizedTileHeight) * curZoom)) + (tileHeight * curZoom) / 2);
                ctx.lineTo(shadowXpos + (tileHeight * curZoom), shadowYpos + ((currStack - 1) * ((tileHeight - resizedTileHeight) * curZoom)) + (tileHeight * curZoom));
                ctx.fill();
              }
            }
            if (shadowSettings.horizontalColor) {

              // Apply Horizontal shadows on stacked tiles

              if (!distanceLightingSettings  || (distanceLighting < distanceLightingSettings.darkness)) {
                ctx.fillStyle = 'rgba' + (typeof shadowSettings.horizontalColor === 'string' ? shadowSettings.horizontalColor : shadowSettings.horizontalColor[i][j]);
                ctx.beginPath();
                ctx.moveTo(xpos + (tileHeight * curZoom), ypos - ((currStack - 1) * (tileHeight * curZoom)));
                ctx.lineTo(xpos + (tileHeight * curZoom), ypos - ((nextStack - 1) * ((tileHeight + shadowSettings.offset) / ((tileHeight + shadowSettings.offset) / shadowSettings.offset)  * curZoom)));
                ctx.lineTo(xpos + (tileHeight * curZoom) * 2, ypos - ((nextStack - 1) * (tileHeight + shadowSettings.offset) / ((tileHeight + shadowSettings.offset) / shadowSettings.offset) * curZoom) + (tileHeight * curZoom) / 2);
                ctx.lineTo(xpos + (tileHeight * curZoom) * 2, ypos - ((currStack - 1) * ((tileHeight ) * curZoom)) + (tileHeight * curZoom) / 2);
                ctx.fill();
              }
            }
          }
        }
        else {

          // Shadows without height map e.g. Object Shadows

          currStack = Math.round(Number(mapLayout[i][j - 1]));
          if(currStack > 0) {
            shadowXpos = (i - j) * (tileHeight * curZoom) + drawX;
            shadowYpos = (i + j) * (tileWidth / 4 * curZoom) + drawY;
            ctx.fillStyle = 'rgba' + (typeof shadowSettings.verticalColor === 'string' ? shadowSettings.verticalColor : shadowSettings.verticalColor[i][j]);
            ctx.beginPath();
            ctx.moveTo(shadowXpos, shadowYpos + (currStack * ((tileHeight - resizedTileHeight) * curZoom)) + (tileHeight * curZoom) / 2);
            ctx.lineTo(shadowXpos + (tileHeight * curZoom), shadowYpos + (currStack * ((tileHeight - resizedTileHeight) * curZoom)));
            ctx.lineTo(shadowXpos + (tileHeight * curZoom) * 2, shadowYpos + (currStack * ((tileHeight - resizedTileHeight) * curZoom)) + (tileHeight * curZoom) / 2);
            ctx.lineTo(shadowXpos + (tileHeight * curZoom), shadowYpos + (currStack * ((tileHeight - resizedTileHeight) * curZoom)) + (tileHeight * curZoom));
            ctx.fill();
          }
        }
      }
      if (distanceLightingSettings) {
        if (distanceLightingSettings.color !== false) {
          -- k;
          if (distanceLighting < distanceLightingSettings.darkness) {

            // Apply distance shadows from light source
            if (!isometric) {
              ctx.fillStyle = 'rgba(' + distanceLightingSettings.color + ',' + distanceLighting + ')';
              ctx.beginPath();
              ctx.moveTo(xpos, ypos);
              ctx.lineTo(xpos + tileHeight * curZoom, ypos);
              ctx.lineTo(xpos + tileHeight * curZoom, ypos + tileHeight * curZoom);
              ctx.lineTo(xpos, ypos + tileHeight * curZoom);
              ctx.fill();
            }
            else {
              ctx.fillStyle = 'rgba(' + distanceLightingSettings.color + ',' + distanceLighting + ')';
              ctx.beginPath();
              ctx.moveTo(xpos, ypos + ((k - 2) * ((tileHeight - resizedTileHeight) * curZoom)) + (tileHeight * curZoom) / 2);
              ctx.lineTo(xpos + (tileHeight * curZoom), ypos + ((k - 2) * ((tileHeight - resizedTileHeight) * curZoom)));
              ctx.lineTo(xpos + (tileHeight * curZoom) * 2, ypos + ((k - 2) * ((tileHeight - resizedTileHeight) * curZoom)) + (tileHeight * curZoom) / 2);
              ctx.lineTo(xpos + (tileHeight * curZoom), ypos + ((k - 2) * ((tileHeight - resizedTileHeight) * curZoom)) + (tileHeight * curZoom));
              ctx.fill();
            }

          }
        }
      }
      if (mouseUsed && applyInteractions) {
        if (i === focusTilePosX && j === focusTilePosY) {
          // Apply mouse over tile coloring
          if (!isometric) {
            ctx.fillStyle = 'rgba(255, 255, 120, 0.7)';
            ctx.beginPath();
            ctx.moveTo(xpos, ypos);
            ctx.lineTo(xpos + tileHeight * curZoom, ypos);
            ctx.lineTo(xpos + tileHeight * curZoom, ypos + tileHeight * curZoom);
            ctx.lineTo(xpos, ypos + tileHeight * curZoom);
            ctx.fill();
          }
          else {
            ctx.fillStyle = 'rgba(255, 255, 120, 0.7)';
            ctx.beginPath();
            ctx.moveTo(xpos, ypos + ((k - 2) * ((tileHeight - resizedTileHeight) * curZoom)) + (tileHeight * curZoom) / 2);
            ctx.lineTo(xpos + (tileHeight * curZoom), ypos + ((k - 2) * ((tileHeight - resizedTileHeight) * curZoom)));
            ctx.lineTo(xpos + (tileHeight * curZoom) * 2, ypos + ((k - 2) * ((tileHeight - resizedTileHeight) * curZoom)) + (tileHeight * curZoom) / 2);
            ctx.lineTo(xpos + (tileHeight * curZoom), ypos + ((k - 2) * ((tileHeight - resizedTileHeight) * curZoom)) + (tileHeight * curZoom));
            ctx.fill();
          }
        }
      }
    }

    function _stackTiles(settings) {
      stackTiles = true;
      if (settings.heightTile) {
        stackTileGraphic = settings.heightTile;
      }
      heightMap = settings.map;
      heightOffset = settings.offset;
      heightMapOnTop = settings.heightMapOnTop || false;
    }

    function _particleTiles(map) {
      particleTiles = true;
      particleMap = map;
    }

    function _setLight(posX, posY) {
      lightX = posX;
      lightY = posY;
    }

    function _getLayout() {
      return mapLayout;
    }

    function _getHeightLayout() {
      return heightMap;
    }

    function _getTile(posX, posY) {
      if (mapLayout[posX] && mapLayout[posX][posY]) {
        return mapLayout[posX][posY];
      }
      return null;
    }

    function _getHeightMapTile(posX, posY) {
      return heightMap[posX][posY];
    }

    function _setZoom(dir) {
      if (Number(dir)) {
        curZoom = dir;
      }
      else if (dir === "in") {
        if (curZoom  + 0.1 <= 1) {
          curZoom += 0.1;
        }
        else {
          curZoom = 1;
        }
      }else if (dir === "out") {
        if (curZoom - 0.1 > 0.1) {
          curZoom -= 0.1;
        }
        else {
          curZoom = 0.1;
        }
      }
    }

    function _adjustLight(setting, increase) {
      if (increase) {
        shadowDistance.distance += setting;
      }
      else {
        shadowDistance.distance -= setting;
      }
    }

    function _getXYCoords(x, y) {
      var positionY, positionX;
      if (!isometric) {
        positionY = Math.round((y - (tileWidth * curZoom) / 2)/ (tileWidth * curZoom));
        positionX = Math.round((x - (tileHeight * curZoom) / 2)/ (tileHeight * curZoom));
      }
      else {
        positionY = (2 * (y - drawY) - x + drawX) / 2;
        positionX = x + positionY - drawX - (tileHeight * curZoom);
        positionY = Math.round(positionY / (tileHeight * curZoom));
        positionX = Math.round(positionX / (tileHeight * curZoom));
      }
      return({x: positionX, y: positionY});
    }

    function _applyMouseFocus(x, y) {
      mouseUsed = true;
      if (!isometric) {
        focusTilePosY = Math.round((y - (tileWidth * curZoom) / 2)/ (tileWidth * curZoom));
        focusTilePosX = Math.round((x - (tileHeight * curZoom) / 2)/ (tileHeight * curZoom));
      }
      else {
        focusTilePosY = (2 * (y - drawY) - x + drawX) / 2;
        focusTilePosX = x + focusTilePosY - drawX - (tileHeight * curZoom);
        focusTilePosY = Math.round(focusTilePosY / (tileHeight * curZoom));
        focusTilePosX = Math.round(focusTilePosX / (tileHeight * curZoom));
      }
      return({x: focusTilePosX, y: focusTilePosY});
    }

    function _setTile(x, y, val) {
      mapLayout[x][y] = val;
    }

    function _setHeightmapTile(x, y, val) {
      heightMap[x][y] = val;
    }

    function _setParticlemapTile(x, y, val) {
      if(!particleMap[x]) {
        particleMap[x] = [];
      }
      particleMap[x][y] = val;
    }

    function _setLightmap(lightmapArray) {
      lightMap = lightmapArray;
    }

    function _applyFocus(xPos, yPos) {
      focusTilePosX = xPos;
      focusTilePosY = yPos;
    }

    function _align(position, screenDimension, size, offset) {
      switch(position) {
        case "h-center":
          if (isometric) {
            drawX = (screenDimension / 2) - ((tileWidth / 4  * size) * curZoom) / (size / 2);
          }
          else {
            drawX = (screenDimension / 2) - ((tileWidth/2  * size) * curZoom);
          }
        break;
        case "v-center":
          drawY = (screenDimension / 2) - ((tileHeight/2 * size) * curZoom) - ((offset * tileHeight) * curZoom) / 4;
        break;
      }
    }

    function _hideGraphics(toggle, settings) {
      tilesHide = toggle;
      if (settings) {
        hideSettings = settings;
      }
    }

    function _applyHeightShadow(toggle, settings) {
      if (toggle) {
        if(settings || shadowSettings) {
          heightShadows = true;
        }
      }
      else{
        if(settings || shadowSettings) {
          heightShadows = false;
        }
      }
      if (settings) {
        shadowSettings = settings;
      }
    }

    function _flip(setting) {
      if (stackTiles) {
        heightMap = utils.flipTwoDArray(heightMap, setting);
      }
      if (particleTiles) {
        particleMap = utils.flipTwoDArray(particleMap, setting);
      }
      mapLayout = utils.flipTwoDArray(mapLayout, setting);

    }

    function _rotate(setting) {
      if (stackTiles) {
        heightMap = utils.rotateTwoDArray(heightMap, setting);
      }
      if (particleTiles) {
        particleMap = utils.rotateTwoDArray(particleMap, setting);
      }
      mapLayout = utils.rotateTwoDArray(mapLayout, setting);
    }

    return {

      setup: function(settings) {
        return _setup(settings);
      },

      draw: function(tileX, tileY, tileImageOverwite) {
        return _draw(tileX, tileY, tileImageOverwite);
      },

      stackTiles: function(settings) {
        return _stackTiles(settings);
      },

      particleTiles: function(map) {
        return _particleTiles(map);
      },

      getLayout: function() {
        return _getLayout();
      },

      getHeightLayout: function() {
        return _getHeightLayout();
      },

      getTitle: function() {
        return title;
      },

      getTile: function(tileX, tileY) {
        return Number(_getTile(tileX, tileY));
      },

      getHeightMapTile: function(tileX, tileY) {
        return Number(_getHeightMapTile(tileX, tileY));
      },

      setTile: function(tileX, tileY, val) {
        _setTile(tileX, tileY, val);
      },

      setHeightmapTile: function(tileX, tileY, val) {
        _setHeightmapTile(tileX, tileY, val);
      },

      setZoom: function(direction) {
        // in || out
        return _setZoom(direction);
      },

      setLight: function(tileX, tileY) {
        return _setLight(tileX, tileY);
      },

      setLightmap: function(lightmap) {
        _setLightmap(lightmap);
      },

      setParticlemapTile: function(tileX, tileY, val) {
        _setParticlemapTile(tileX, tileY, val);
      },

      getXYCoords: function(XPosition, YPosition) {
        return _getXYCoords(XPosition, YPosition);
      },

      applyMouseFocus: function(mouseXPosition, mouseYPosition) {
        return _applyMouseFocus(mouseXPosition, mouseYPosition);
      },

      applyFocus: function(tileX, tileY) {
        return _applyFocus(tileX, tileY);
      },

      align: function(position, screenDimension, size, offset) {
        return _align(position, screenDimension, size, offset);
      },

      hideGraphics: function(toggle, settings) {
        return _hideGraphics(toggle, settings);
      },

      applyHeightShadow: function(toggle, settings) {
        return _applyHeightShadow(toggle, settings);
      },

      rotate: function(direction) {
        // left || right
        return _rotate(direction);
      },

      flip: function(direction) {
        // horizontal || vertical
        return _flip(direction);
      },

      toggleGraphicsHide: function(toggle) {
        if (tilesHide !== null) {
          _hideGraphics(toggle);
        }
      },

      toggleHeightShadow: function(toggle) {
        if (heightShadows !== null) {
          _applyHeightShadow(toggle);
        }
      },

      setLightness: function(setting) {
        shadowDistance.distance = setting;
      },

      adjustLightness: function(setting, increase) {
        _adjustLight(setting, increase);
      },

      setOffset: function(x, y) {
        drawX = x;
        drawY = y;
      },

      getLightness: function() {
        return shadowDistance.distance;
      },

      move: function(direction) {
        // left || right || up || down
        if (direction === "up") {
          drawY += tileHeight/2 * curZoom;
          drawX += tileHeight * curZoom;
        }
        else if (direction === "down") {
          drawY += tileHeight/2 * curZoom;
          drawX -= tileHeight * curZoom;
        }
        else if (direction === "left") {
          drawY -= tileHeight/2 * curZoom;
          drawX -= tileHeight * curZoom;
        }
        else if (direction === "right") {
          drawY -= tileHeight/2 * curZoom;
          drawX += tileHeight * curZoom;
        }
      }

    };
  };
});