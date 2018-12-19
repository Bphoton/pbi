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
import DataViewObjects = powerbi.extensibility.utils.dataview.DataViewObjects;
import TextProperties = powerbi.extensibility.utils.formatting.TextProperties;
import textMeasurementService = powerbi.extensibility.utils.formatting.textMeasurementService;

module powerbi.extensibility.visual {
    "use strict";

    interface DataPoint { //DataPoint is not Typed here, only category and value
        category: string;
        value: number;
        color: string;
        identity: powerbi.visuals.ISelectionId;
        highlighted: boolean;
    };
    
    //Container for the datapoints plus some extra data
    interface ViewModel { //separator b/t the code getting the data and render the data
        dataPoints: DataPoint[]; //DataPoint as a whole is Typed here
        ranges: Ranges;
        highlights: boolean;
    };

    interface Range {
        min: number;
        max: number;
    }

    interface Ranges {
        measure: Range;
        color?: Range;
    }

    export class Visual implements IVisual {
        private host: IVisualHost; //access the api
        private svg: d3.Selection<SVGElement>; //live refference to an SVG element
        private barTextGroup: d3.Selection<SVGElement>;
        private barGroup: d3.Selection<SVGElement>; //group all bars
        private xPadding: number = 0.1; //padding b/w each bar
        private selectionManager: ISelectionManager; //access any pbi selections
        private xAxisGroup: d3.Selection<SVGElement>;
        private tickSizeX: number = 1;
        private tickSizeY: number = 1;
        private yAxisGroup: d3.Selection<SVGElement>;

        private settings: VisualSettings = new VisualSettings();
        // {
        //     axis: {
        //         x: {
        //             padding: {
        //                 default: 50,
        //                 value: 50
        //             },
        //             show: {
        //                 default: true,
        //                 value: true
        //             }
        //         },
        //         y: {
        //             padding: {
        //                 default: 50,
        //                 value: 50
        //             }
        //         }
        //     },
        //     border: {
        //         top: {
        //             default: 10,
        //             value: 10
        //         }
        //     }
        // }

        constructor(options: VisualConstructorOptions) {
            this.host = options.host; //hover over to see Type /make it a member var
            this.svg = d3.select(options.element) //o.e is the main container for pbiviz
                .append("svg")
                .classed("bar-Chart", true); //true to write to the element

            this.barTextGroup = this.svg.append("g")
                .classed('bar-Text-Group', true );

            this.barGroup = this.svg.append("g")
                .classed('bar-Group', true);

            this.xAxisGroup = this.svg.append("g")
                .classed("x-axis", true);

            this.yAxisGroup = this.svg.append("g")
                .classed("y-axis", true);

            this.selectionManager = this.host.createSelectionManager();

        }
        @logExceptions()
        public update(options: VisualUpdateOptions) {
            this.settings = this.updateSettings(options);

            let viewModel = this.getViewModel(options); //asign ViewModel

            let width = options.viewport.width; //asign for container
            let height = options.viewport.height;

            this.svg.attr({ //update svg to the size of the container
                width: width,
                height: height
            });

            let { //??? do I need this here
                xAxis: xAxisSettings, 
                yAxis: yAxisSettings,
                chart: chartSettings,
            } = this.settings

            let xAxisPadding = xAxisSettings.show ? xAxisSettings.padding : 0;

            let yScale = d3.scale.linear() //asign the yScale
                .domain([0, viewModel.ranges.measure.max]) //get viewModel max
                .range([height - xAxisPadding, chartSettings.topMargin]); //flip the axis /get options.viewport.height, so the number does not get cut off

            let yAxis = d3.svg.axis()
                .scale(yScale)
                .orient("left")
                .tickSize(this.tickSizeY);

            this.yAxisGroup
                .call(yAxis)
                .attr({
                    transform: "translate(" + yAxisSettings.padding + ",0)"
                })
                .style({
                    fill: "#000"
                })
                .selectAll("text")
                .style({
                    "text-anchor": "end",
                    "font-size": `${chartSettings.labelFontSize}px`,
                    
                });

            let xScale = d3.scale.ordinal() //asign the xScale
                .domain(viewModel.dataPoints.map(d => d.category)) //map category to range
                .rangeRoundBands([ yAxisSettings.padding, width], this.xPadding); //(boundaries, padding)

            let xAxis = d3.svg.axis()
                .scale(xScale)
                .orient("buttom")
                .tickSize(this.tickSizeX);

            //xAxis(this.xAxisGroup); //same as below
            this.xAxisGroup.call(xAxis); //w/this now we can transfor it with another function

            //            // this.yAxisGroup = this.svg.append("g")
            //     .classed("y-axis", true);

            let rotateText: boolean = true;
            this.xAxisGroup
                .call(xAxis)

            let textProperties: TextProperties = {
                fontFamily: "sans-serif",
                fontSize: "24px"
            };

            this.xAxisGroup
                .attr({
                    transform: `translate(0, ${height - xAxisPadding})`,
                })
                .style({
                    fill: "#000"
                })
                .selectAll("text")
                .each(function(text: string, index: number){
                    let textElement: SVGTextElement = this
                    let $text: d3.Selection<SVGTextElement> = d3.select(textElement)
                    if(index % 2 === 0){
                        $text.style("display", "none")
                    } else {
                        $text.style("display", "block")
                    }

                    let localTextProps: TextProperties = textMeasurementService.getMeasurementProperties(textElement)
                   
                    let { width, height } = textMeasurementService.measureSvgTextRect(localTextProps, text)
                    
                    if(width > 120){
                        let newText = textMeasurementService.getTailoredTextOrDefault(localTextProps, 120);
                        $text.text(newText)
                    }
                    $text.attr({
                        "text-anchor": null,
                        transform: rotateText === true 
                            ? "rotate(-15)"
                            : "rotate(0)" 
                    })
                    .style({
                        "dominant-baseline": "baseline",
                        "text-anchor": "end", 
                        "font-size": "12px"
                    })
                })
             
            let bars$update: d3.selection.Update<DataPoint> = this.barGroup //Bin html to data with svg
                .selectAll(".bar")
                .data(viewModel.dataPoints, d => d.category)
                

            let bars$enter: d3.selection.Enter<DataPoint> = bars$update.enter() //Enter the data
              
            // Creating container g
            let bars$enter$g = bars$enter
                .append("g")
                .classed("bar", true)

            // Creating rect within g
            bars$enter$g
                .append('rect')
                .classed('bar__rect', true)

            // Creating text within g

            bars$enter$g
                .append('text')
                .classed('bar__text', true)

            const isHighlighted = (d: DataPoint) : number => d.highlighted === true ? 1.0 : 0.5 

            bars$update.each(function(d: DataPoint, index: number){
                let $group = d3.select(this)
                let $text = $group.select('text')
                let $rect = $group.select('rect')
                let props = {
                    x: xScale(d.category),
                    y: yScale(d.value),
                    width: xScale.rangeBand(),
                    height: height - yScale(d.value) - xAxisPadding
                }
               
                $text.text(d.category)
                    .attr({
                    // x: props.x + (props.width / 2),
                    // y: props.y,
                    x: props.x - props.x,
                    y: props.y - props.y,
                    "text-anchor": "start", 
                    "alignment-baseline": "middle",
                    "font-size": "12px",
                    transform: `rotate(90), translate(${props.y + 2}, ${-props.x - (props.width / 2)})`
                    //translate(${props.y + 2}, ${-props.x - 10}
                    
                    
                    //rotate(-10) translate(props.x, props.y)
                })
                
                   
               // $rect.text(d.value)
                $rect.attr(props)
                .style({
                    fill: d.color,
                    "fill-opacity": viewModel.highlights === true 
                    ? isHighlighted(d)
                    : 1.0 //???
                })
                .on("click", () => { //get the id of the selection
                    this.selectionManager
                    .select(d.identity, true) //true: for multiple selections
                    .then(ids => {
                        $rect.style({ //check to see if the current id is selected then highlight 
                            "fill-opacity": ids.length > 0 ?
                             ids.indexOf(d.identity) >= 0 ? 1.0 : 0.5 : 1.0 //???
                        });
                    });
                }); //need to add ctrl click for multiple selections                                                
            });
                bars$update.exit() //Remove the data
                .remove();



//???            let dataViews = undefined
//???
            // if(dataViews && dataViews[0] && dataViews[0].categorical && dataViews[0].categorical.values){
            //     console.log('Has the stuffs')
            // }
        }

        private updateSettings(options: VisualUpdateOptions) : VisualSettings {
            return VisualSettings.parse(options.dataViews[0]) as VisualSettings;

            // this.settings.axis.x.show.value = DataViewObjects.getValue(
            //     options.dataViews[0].metadata.objects, {
            //         objectName: "xAxis",
            //         propertyName: "show"
            //     },
            //     this.settings.axis.x.show.default);
        }

    
        @logExceptions()
        public getViewModel(options: VisualUpdateOptions): ViewModel { //get data dynamically from the user
            let dv = options.dataViews; //get the data into a specific shape

            if (!dv //dont return anything untill all fields are filled in
                || !dv[0]
                || !dv[0].categorical
                || !dv[0].categorical.categories
                || !dv[0].categorical.categories[0].source
                || !dv[0].categorical.values)
                return {
                    dataPoints: [],
                    ranges: { measure: { min: 0, max: 0} },
                    highlights: false
                };

            let categories: DataViewCategoryColumn[] = dv[0].categorical.categories; //get category array /0 is for multiple ceires
            let category: DataViewCategoryColumn = categories[0];

            let values: DataViewValueColumns = dv[0].categorical.values; //0 is for multiple ceries
            let measure: DataViewValueColumn = values[0]
            let color: DataViewValueColumn = values[1]
            
            let highlights = measure.highlights; //optional, thus may or may not be defined

            let viewModel: ViewModel = { //init viewModel /init something even if there is nothign there
                dataPoints: [],
                ranges: { 
                    measure: {
                        min: Math.min(...(<number[]>measure.values)),
                        max: Math.max(...(<number[]>measure.values))
                    }
                },
                highlights: false
            };

            let hasColorValues: boolean = color && color.values !== undefined

            if(hasColorValues){
                viewModel.ranges.color = {
                    min: Math.min(...(<number[]>color.values)),
                    max: Math.max(...(<number[]>color.values))
                }


                // viewModel.ranges = { ...viewModel.ranges, 
                //     color: {
                //         min: Math.min(...(<number[]>color.values)),
                //         max: Math.max(...(<number[]>color.values))
                //     }
                // }
                
            }
            

        let {color : colorSettings
             } = this.settings
            // let categories2, values2
            // dv[0] = undefined
            // try {
            //     let { categories, values } = dv[0].categorical
            //     if(!categories[0].source){
            //         throw new Error('No source in first category')
            //     }
            //     categories2 = categories
            //     values2 = values
            // } catch(e){
            //     console.error('Data view is incomplete, no columns found.')
            //     // return viewModel
            // }
            // console.log('Error is done, continuing')
           
            let colorRange: Range = viewModel.ranges.color !== undefined
                ? viewModel.ranges.color
                : viewModel.ranges.measure
            
            //d3Color
            let colorScale = d3.scale.linear<string>()
                .domain([0, colorRange.max])
                .range([colorSettings.colorPickedMin, colorSettings.colorPickedMax]);

            //make sure categories and values are the same legth
            for (let i = 0, len = Math.max(category.values.length, measure.values.length); i < len; i++) { //loop through everything
                viewModel.dataPoints.push({ //push everyting to the viewModel
                    category: (<string>category.values[i]).trim(), //since categories.value is of PrimitiveType we have to specify Type here again
                    value: <number>measure.values[i],
                    color: colorScale(<number>((color && color.values && color.values[i]) || measure.values[i])),//this.host.colorPalette.getColor(<string>categories.values[i]).value,
                    identity: this.host.createSelectionIdBuilder()
                        .withCategory(category, i)
                        .createSelectionId(),
                    highlighted: highlights !== undefined
                        ? highlights[i] !== undefined
                            ? true 
                            : false 
                        : false 
                });
            }
            //from the viewModel get the max
            //viewModel.maxValue = d3.max(viewModel.dataPoints, d => d.value);
            viewModel.highlights = viewModel.dataPoints.filter(d => d.highlighted).length > 0;

            type SortDataPointsCallback = (a: DataPoint, b: DataPoint) => number;

 
            const getSortDataPointsByPropertyCallback = (propertyName: string) : SortDataPointsCallback => {
                return (a: DataPoint, b: DataPoint) : number => {
                    return a[propertyName] > b[propertyName] 
                        ? 1 
                        : a[propertyName] === b[propertyName] 
                            ? 0 
                            : -1
                }
            }

            // let addWithCallback = function(
            //     a: number, 
            //     b: number, 
            //     onDoneAdding: (sum: number) => void, 
            //     onError: (err: Error) => void
            // ) : void{
            //     let sum: number
            //     try {
            //         if(typeof a !== 'number' || typeof b !== 'number'){
            //             throw new Error('One of your parameters is not a number')
            //         }
            //         sum = a + b
            //         onDoneAdding(sum)
            //     } catch(err){
            //         onError(err)
            //     }
                
            // }

            // addWithCallback(1, 2, 
            //     sum => {
            //         console.log(`The sum is ${sum}`)
            //     },
            //     err => {
            //         console.error(err)
            //     })

            let sortDataPointsCallback: SortDataPointsCallback
            let shouldReverse: boolean = true
            if(hasColorValues){
                sortDataPointsCallback = getSortDataPointsByPropertyCallback('value')
            } else {
                sortDataPointsCallback = getSortDataPointsByPropertyCallback('color')
            }

            viewModel.dataPoints = viewModel.dataPoints.sort(sortDataPointsCallback)

            if(shouldReverse) viewModel.dataPoints = viewModel.dataPoints.reverse()

            //reduce number of datapoints
            if(viewModel.dataPoints.length > 25){
                viewModel.dataPoints = viewModel.dataPoints.slice(0, 25)
            }

            return viewModel;
        }
        public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): //pbi calls when properties are updated in the settings (Propertis pane)
            VisualObjectInstanceEnumeration {
            
            let propertyGroupName = options.objectName;
            let properties: VisualObjectInstanceEnumeration = [];
                switch (propertyGroupName) {
                // case "xAxis":
                //     properties.push({
                //         objectName: propertyGroupName,
                //         properties: {
                //             show: this.settings.axis.x.show.value
                //         },
                //         selector: null
                //     });
                //     break;
                default: {
                    properties = VisualSettings.enumerateObjectInstances(this.settings || VisualSettings.getDefault(), options)
                }
            };
            return properties;
        }
    }

  

    // Check for errors
    export function logExceptions(): Function {
        return function (target: Object, propertyKey: string, descriptor: TypedPropertyDescriptor<Function>)
            : TypedPropertyDescriptor<Function> {

            return {
                value: function () {
                    try {
                        return descriptor && descriptor.value && descriptor.value.apply(this, arguments);
                    } catch (e) {
                        console.error(e);
                        throw e;
                    }
                }
            }
        }
    }
}