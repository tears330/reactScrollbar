import '../less/scrollbar.less';
import React from 'react';
import ScrollBar from './scrollBar';
import {findDOMNode, warnAboutFunctionChild, warnAboutElementChild, positiveOrZero, modifyObjValues} from './utils';
import lineHeight from 'line-height';
import {Motion, spring} from 'react-motion';

const eventTypes= {
    wheel: 'wheel',
    api: 'api',
    touch: 'touch',
    touchEnd: 'touchEnd',
    mousemove: 'mousemove'
};

export default class ScrollArea extends React.Component{
    constructor(props){
        super(props);
        this.state = {
            topPosition: 0,
            leftPosition: 0,
            realHeight: 0,
            containerHeight: 0,
            realWidth: 0,
            containerWidth: 0
        };

        this.scrollArea = {
            refresh: () => {
                this.setSizesToState();
            },
            scrollTop: () => {
                this.scrollTop();
            },
            scrollBottom: () => {
                this.scrollBottom();
            },
            scrollYTo: (position) => {
                this.scrollYTo(position);
            },
            scrollLeft: () => {
                this.scrollLeft();
            },
            scrollRight: () => {
                this.scrollRight();
            },
            scrollXTo: (position) => {
                this.scrollXTo(position);
            }
        };
        
        this.evntsPreviousValues = {
            clientX: 0,
            clientY: 0,
            deltaX: 0,
            deltaY: 0
        }

        this.bindedHandleWindowResize = this.handleWindowResize.bind(this);
    }

    getChildContext(){
        return {
            scrollArea: this.scrollArea
        };
    }

    componentDidMount(){
        window.addEventListener("resize", this.bindedHandleWindowResize);
        this.lineHeightPx = lineHeight(findDOMNode(this.content));
        this.setSizesToState();
    }

    componentWillUnmount(){
        window.removeEventListener("resize", this.bindedHandleWindowResize);
    }

    componentDidUpdate(){
        this.setSizesToState();
    }

    render(){
        let {children, className, contentClassName} = this.props
        let withMotion = this.props.smoothScrolling && 
            (this.state.eventType === eventTypes.wheel || this.state.eventType === eventTypes.api || this.state.eventType === eventTypes.touchEnd);
        
        let scrollbarY = this.canScrollY()? (
            <ScrollBar
                realSize={this.state.realHeight}
                containerSize={this.state.containerHeight}
                position={-this.state.topPosition}
                onMove={this.handleScrollbarMove.bind(this)}
                containerStyle={this.props.verticalContainerStyle}
                scrollbarStyle={this.props.verticalScrollbarStyle}
                smoothScrolling={withMotion}
                minScrollSize={this.props.minScrollSize}
                type="vertical"/>
        ): null;

        let scrollbarX = this.canScrollX()? (
            <ScrollBar
                realSize={this.state.realWidth}
                containerSize={this.state.containerWidth}
                position={-this.state.leftPosition}
                onMove={this.handleScrollbarMove.bind(this)}
                containerStyle={this.props.horizontalContainerStyle}
                scrollbarStyle={this.props.horizontalScrollbarStyle}
                smoothScrolling={withMotion}
                minScrollSize={this.props.minScrollSize}
                type="horizontal"/>
        ): null;

        if(typeof children === 'function'){
            warnAboutFunctionChild();
            children = children();
        } else {
            warnAboutElementChild();
        }

        let classes = 'scrollarea ' + (className || '');
        let contentClasses = 'scrollarea-content ' + (contentClassName || '');
        
        let contentStyle = {
            marginTop: this.state.topPosition,
            marginLeft: this.state.leftPosition
        };
        let springifiedContentStyle = withMotion ? modifyObjValues(contentStyle, x => spring(x)) : contentStyle;
        
        return (
            <Motion style={{...this.props.contentStyle, ...springifiedContentStyle}}>
                { style => 
                    <div ref={x => this.wrapper = x} style={this.props.style} className={classes} onWheel={this.handleWheel.bind(this)}>
                        <div ref={x => this.content = x}
                            style={style}
                            className={contentClasses}
                            onTouchStart={this.handleTouchStart.bind(this)}
                            onTouchMove={this.handleTouchMove.bind(this)}
                            onTouchEnd={this.handleTouchEnd.bind(this)}>
                            {children}
                        </div>
                        {scrollbarY}
                        {scrollbarX}
                    </div>
                }
            </Motion>
        );
    }
    
    setStateFromEvent(newState, eventType){
        this.setState({...newState, eventType});
    }

    handleTouchStart(e){
        let {touches} = e;
        if(touches.length === 1){
            let {clientX, clientY} = touches[0];
            this.eventPreviousValues = {
                ...this.eventPreviousValues,
                clientY,
                clientX,
                timestamp: Date.now()
            };
        }
    }

    handleTouchMove(e){
        e.preventDefault();
        
        let {touches} = e;
        if(touches.length === 1){
            let {clientX, clientY} = touches[0];

            let deltaY = this.eventPreviousValues.clientY - clientY;
            let deltaX = this.eventPreviousValues.clientX - clientX;
            
            this.eventPreviousValues = {
                ...this.eventPreviousValues,
                deltaY,
                deltaX,
                clientY,
                clientX,
                timestamp: Date.now()
            };
            
            this.setStateFromEvent(this.composeNewState(-deltaX, -deltaY));
        }
    }
    
    handleTouchEnd(e){
        let {deltaX: lastDeltaX, deltaY: lastDeltaY, timestamp: lastTimestamp} = this.eventPreviousValues;        
        
        if(Date.now() - lastTimestamp < 200){
            this.setStateFromEvent(this.composeNewState(-lastDeltaX * 10, -lastDeltaY * 10), eventTypes.touchEnd);
        }
        
        this.eventPreviousValues = {
            ...this.eventPreviousValues,
            deltaY: 0,
            deltaX: 0
        };      
    }
    
    handleScrollbarMove(deltaY, deltaX){
         this.setStateFromEvent(this.composeNewState(deltaX, deltaY));
    }

    handleWheel(e){
        let deltaY = e.deltaY;
        let deltaX = e.deltaX;

        /*
         * WheelEvent.deltaMode can differ between browsers and must be normalized
         * e.deltaMode === 0: The delta values are specified in pixels
         * e.deltaMode === 1: The delta values are specified in lines
         * https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/deltaMode
         */
        if (e.deltaMode === 1) {
            deltaY = deltaY * this.lineHeightPx;
            deltaX = deltaX * this.lineHeightPx;
        }

        deltaY = deltaY * this.props.speed;
        deltaX = deltaX * this.props.speed;
        
        let newState = this.composeNewState(-deltaX, -deltaY);

        if(this.state.topPosition !== newState.topPosition || this.state.leftPosition !== newState.leftPosition){
            e.preventDefault();
        }

        this.setStateFromEvent(newState, eventTypes.wheel);
    }
    
    handleWindowResize(){
        let newState = this.computeSizes();
        newState = this.getModifiedPositionsIfNeeded(newState);
        this.setStateFromEvent(newState);
    }
    
    composeNewState(deltaX, deltaY){
        let newState = this.computeSizes();
        
        if(this.canScrollY(newState)){
            newState.topPosition = this.computeTopPosition(deltaY, newState);
        }
        if(this.canScrollX(newState)){
            newState.leftPosition = this.computeLeftPosition(deltaX, newState);
        }
        
        return newState;
    }

    computeTopPosition(deltaY, sizes){
        let newTopPosition = this.state.topPosition + deltaY;
        return this.normalizeTopPosition(newTopPosition, sizes);
    }

    computeLeftPosition(deltaX, sizes){
        let newLeftPosition = this.state.leftPosition + deltaX;
        return this.normalizeLeftPosition(newLeftPosition, sizes);
    }
    
    normalizeTopPosition(newTopPosition, sizes){    
        if(-newTopPosition > sizes.realHeight - sizes.containerHeight){
            newTopPosition = -(sizes.realHeight - sizes.containerHeight);
        }
        if(newTopPosition > 0){
            newTopPosition = 0;
        }
        return newTopPosition;
    }
    
    normalizeLeftPosition(newLeftPosition, sizes){
        if(-newLeftPosition > sizes.realWidth - sizes.containerWidth){
            newLeftPosition = -(sizes.realWidth - sizes.containerWidth);
        } else if(newLeftPosition > 0){
            newLeftPosition = 0;
        }

        return newLeftPosition;
    }

    computeSizes(){
        let realHeight = this.content.offsetHeight;
        let containerHeight = this.wrapper.offsetHeight;
        let realWidth = this.content.offsetWidth;
        let containerWidth = this.wrapper.offsetWidth;

        return {
            realHeight: realHeight,
            containerHeight: containerHeight,
            realWidth: realWidth,
            containerWidth: containerWidth
        };
    }

    setSizesToState(){
        let sizes = this.computeSizes();
        if(sizes.realHeight !== this.state.realHeight || sizes.realWidth !== this.state.realWidth){
            this.setStateFromEvent(this.getModifiedPositionsIfNeeded(sizes));
        }
    }

    scrollTop(){
        this.setStateFromEvent({topPosition: 0}, eventTypes.api);
    }

    scrollBottom(){
        this.setStateFromEvent({topPosition: -(this.state.realHeight - this.state.containerHeight)}, eventTypes.api);
    }
    
    scrollLeft(){
        this.setStateFromEvent({leftPosition: 0}, eventTypes.api);
    }

    scrollRight(){
        this.setStateFromEvent({leftPosition: -(this.state.realWidth - this.state.containerWidth)}, eventTypes.api);
    }

    scrollYTo(topPosition){
        let position = this.normalizeTopPosition(-topPosition, this.computeSizes());
        this.setStateFromEvent({topPosition: position}, eventTypes.api);
    }
    
    scrollXTo(leftPosition){
        let position = this.normalizeLeftPosition(-leftPosition, this.computeSizes());
        this.setStateFromEvent({leftPosition: position}, eventTypes.api);
    }

    canScrollY(state = this.state){
        return this.props.vertical;
    }

    canScrollX(state = this.state){
        return this.props.horizontal;
    }

    getModifiedPositionsIfNeeded(newState){
        let bottomPosition = newState.realHeight - newState.containerHeight;
        if(-this.state.topPosition >= bottomPosition){
            newState.topPosition = this.canScrollY(newState)? -positiveOrZero(bottomPosition): 0;
        }

        let rightPosition = newState.realWidth - newState.containerWidth;
        if(-this.state.leftPosition >= rightPosition){
            newState.leftPosition = this.canScrollX(newState)? -positiveOrZero(rightPosition): 0;
        }

        return newState;
    }
}

ScrollArea.childContextTypes = {
    scrollArea: React.PropTypes.object
};

ScrollArea.propTypes = {
    className: React.PropTypes.string,
    style: React.PropTypes.object,
    speed: React.PropTypes.number,
    contentClassName: React.PropTypes.string,
    contentStyle: React.PropTypes.object,
    vertical: React.PropTypes.bool,
    verticalContainerStyle: React.PropTypes.object,
    verticalScrollbarStyle: React.PropTypes.object,
    horizontal: React.PropTypes.bool,
    horizontalContainerStyle: React.PropTypes.object,
    horizontalScrollbarStyle: React.PropTypes.object,
    smoothScrolling: React.PropTypes.bool,
    minScrollSize: React.PropTypes.number
};

ScrollArea.defaultProps = {
    speed: 1,
    vertical: true,
    horizontal: true,
    smoothScrolling: false
};
