/*
 *  Power BI Visual CLI
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved.
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */

module powerbi.extensibility.visual {
    "use strict";

    interface DataPoint { //DataPoint is not Types here, only category and value
        category: string;
        value: number;
    };

    //Container for the datapoints plus some extra data
    interface ViewModel { //separator b/t the code getting the data and render the data
        dataPoints: DataPoint[]; //DataPoint as a whole is Typed here
        maxValue: number;
    };

    export class Visual implements IVisual {
        private host: IVisualHost; //access the api
        private svg: d3.Selection<SVGElement>; //live refference to an SVG element
        private barGroup: d3.Selection<SVGElement>; //group all bars
        private xPadding: number = 0.1; //padding b/w each bar

        constructor(options: VisualConstructorOptions) {
            this.host = options.host; //hover over to see Type /make it a member var
            this.svg = d3.select(options.element) //o.e is the main container for pbiviz
                .append("svg")
                .classed("bar-Chart", true); //true to write to the element
            
            this.barGroup = this.svg.append("g")
                .classed('bar-Group', true);
        
        }
        @logExceptions()
        public update(options: VisualUpdateOptions) {
            console.log(`Update: `, options)
            let sample: DataPoint[] = [  //update the data
                {
                    category: "Apples",
                    value: 10
                },
                {
                    category: "Bananas",
                    value: 20
                },
                {
                    category: "Cherries",
                    value: 30
                },
                {
                    category: "Dates",
                    value: 40
                },
                {
                    category: "Elderberries",
                    value: 50
                }
            ];

            let viewModel: ViewModel = { //declare the ViewModel
                dataPoints: sample, 
                maxValue: d3.max(sample, d => d.value)
            };

            let width = options.viewport.width; //declare for container
            let height = options.viewport.height;

            this.svg.attr({ //update svg to the size of the container
                width: width,
                height: height
            });

            let yScale = d3.scale.linear() //declare the yScale
                .domain([0, viewModel.maxValue]) //get viewModel max
                .range([height, 0]); //flip the axis /get options.viewport.height
       
            let xScale = d3.scale.ordinal() //declare the xScale
                .domain(viewModel.dataPoints.map(d => d.category)) //map category to range
                .rangeRoundBands([0, width], this.xPadding); //(boundaries, padding)
            
            let bars = this.barGroup
                .selectAll(".bar")
                .data(viewModel.dataPoints);
            
            bars.enter()
                .append("rect")
                .classed("bar", true);
            
            bars.attr({
                    width: xScale.rangeBand(), //width of the bar
                    height: d => height - yScale(d.value), //flip the yAxis
                    y: d => yScale(d.value), //get value
                    x: d => xScale(d.category) //get category
                });
                
            bars.exit()
                .remove();

        }
    }

     // Check for errors
     export function logExceptions(): Function {
        return function (target: Object, propertyKey: string, descriptor: TypedPropertyDescriptor<Function>)
        : TypedPropertyDescriptor<Function> {
            
            return {
                value: function () {
                    try {
                        return descriptor.value.apply(this, arguments);
                    } catch (e) {
                        console.error(e);
                        throw e;
                    }
                }
            }
        }
    }
}