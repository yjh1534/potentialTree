class PathconditionTree {
  margin = {
    top: 10,
    right: 10,
    bottom: 10,
    left: 30
  }

  constructor(data, svg, tooltip, resetbtn) {
    this.data = data;
    this.svg = d3.select(svg);
    this.container = this.svg.append("g")
      .attr("id", "tree-space")
      .attr("transform", `translate(${this.margin.left}, ${this.margin.top})`);
    
    this.width = this.svg.attr("width");
    this.height = this.svg.attr("height");
    this.mainTask = "overview"
    this.i = 0;
    this.duration = 750;
    this.colorMaprange = 10;

    this.resetbtn = d3.select(resetbtn)
      .on('click', (e) => {
        this.treeX = this.margin.left;
        this.treeY = this.margin.top;
        this.container.transition()
          .duration(this.duration)
          .attr("transform", `translate(${this.margin.left}, ${this.margin.top})`);
      })

    this.dragStarted = this.dragStarted.bind(this);
    this.dragged = this.dragged.bind(this);
    this.dragEnded = this.dragEnded.bind(this);

    this.container.call(
      d3.drag()
      .on("start", this.dragStarted)
      .on("drag", this.dragged)
      .on("end", this.dragEnded)
    );

    this.zoom = d3.zoom()
      .scaleExtent([1, 4])
      .on('zoom', (e) => {
        this.container.transition()
          .duration(this.duration / 3)
          .attr('transform', e.transform);
      });

    this.container.call(this.zoom);

    this.tooltip = d3.select(tooltip);
    // Create a hierarchical layout
    this.treeLayout = d3.tree().size([this.height, this.width]);

    // Create a root node
    this.root = d3.hierarchy(this.data, d => {
      return d.children;
    });
    this.root.x0 = this.height / 2;
    this.root.y0 = 0;



    this.collapseNode = this.collapseNode.bind(this);
    this.diagonal = this.diagonal.bind(this);
    this.toggleNode = this.toggleNode.bind(this);

    this.nodeColorMap = d3.scaleSequential().domain([1, this.colorMaprange]).interpolator(d3.interpolatePuRd);

    this.colorMapSvg = this.svg.append("g")
      .attr("class", "color-map")
      .attr("transform", `translate(${this.margin.left}, ${this.margin.top})`);
    this.colorMapSvg.append("rect")
      .attr("width", 210)
      .attr("height", 30)
      .attr("transform", `translate(0,0)`)
      .attr("fill", "lightsteelblue");
    for (let i = 1; i <= this.colorMaprange; i++) {
      this.colorMapSvg.append("rect")
        .attr("width", 20)
        .attr("height", 20)
        .attr("transform", `translate(${20 * (i - 1)  + 5}, ${5})`)
        .attr("fill", this.nodeColorMap(i));
    }

    // Collapse the root node by default
    this.collapseNode(this.root);

    // Render the tree
    this.update(this.root);
  }

  dragStarted(event) {
    event.subject.fx = event.subject.x;
    event.subject.fy = event.subject.y;
  }

  dragged(event) {
    var tmpTransform = this.container.attr("transform").split("scale")
    var dx = event.x - event.subject.fx;
    var dy = event.y - event.subject.fy;
    event.subject.fx = event.x;
    event.subject.fy = event.y;
    if(tmpTransform.length == 2){
      var translateValue = tmpTransform[0].slice(10,-2).split(", ")
      this.container.attr("transform", `translate(${Number(translateValue[0])+dx}, ${Number(translateValue[1])+dy}) scale${tmpTransform[1]}`);
    } else{
      var translateValue = tmpTransform[0].slice(10,-1).split(", ")
      this.container.attr("transform", `translate(${Number(translateValue[0])+dx}, ${Number(translateValue[1])+dy})`);
    }
    
  }

  dragEnded(event) {
    event.subject.fx = null
    event.subject.fy = null
  }

  collapseNode(d) {
    if (!d.children) {
      d._children = d.children;
      d._children.forEach(this.collapseNode);
      d.children = null;
    }
  }

  diagonal(s, d) {
    const path = `M ${s.y+11.5} ${s.x}
      C ${(s.y + d.y) / 2} ${s.x},
        ${(s.y + d.y) / 2} ${d.x},
        ${d.y-11.5} ${d.x}`
    return path
  }

  toggleNode(event, d) {
    if (this.mainTask == "constraint") {
      console.log("AAA1");
      this.targetConstraint = d.data.constraint;
      this.update(this.root);
    } else {
      if (d.children) {
        console.log("AAA0");
        d._children = d.children;
        d.children = null;
      } else {
        d.children = d._children;
        d._children = null;
      }
      this.update(d);
    }
  }

  fillColor(d) {
    if (d.parent) {
      return this.nodeColorMap(d.data.potential * this.colorMaprange / d.parent.data.potential);
    } else {
      return "lightsteelblue";
    }
  }

  strokeColor(d) {
    console.log(this.mainTask)
    switch (this.mainTask) {      
      case "overview":
        return this.fillColor(d)
      case "constraint":
        return d.data.constraint == this.targetConstraint ? "yellow" : this.fillColor(d);
      case "filtering":
        if (d.children) {
          var minPotential = 100000,
            maxPotential = -1;
          d.children.forEach(child => {
              minPotential = Math.min(minPotential, child.data.potential);
              maxPotential = Math.max(maxPotential, child.data.potential);
            })
          switch(this.criteria){
            case "Biased":
              console.log(this.threshold, (maxPotential - minPotential) * 100 / d.data.potential)
              return this.threshold < (maxPotential - minPotential) * 100 / d.data.potential ? "red" : this.fillColor(d);
            case "Balanced":
              console.log(this.threshold, maxPotential * 100 / d.data.potential)
              return this.threshold > maxPotential * 100 / d.data.potential ? "green" : this.fillColor(d);
          }
        }
        return this.fillColor(d);
    }
  }

  changeTask(task) {
    this.mainTask = task;
    this.targetConstraint = null;
    this.update(this.root);
  }

  filterBy(criteria, threshold) {
    console.log(criteria)
    this.criteria = criteria;
    this.threshold = threshold;
    this.update(this.root);
  }

  mouseoverHandler(e, d) {
    if (d.parent) {
      this.tooltip.select(".tooltip-inner")
        .html(`${d.data.constraint}<br />${d.data.potential} / ${d.parent.data.potential}`);
    } else {
      this.tooltip.select(".tooltip-inner")
        .html(`${d.data.constraint}<br />${d.data.potential} / root`);
    }
    Popper.createPopper(e.target, this.tooltip.node(), {
      placement: 'top',
      modifiers: [{
        name: 'arrow',
        options: {
          element: this.tooltip.select(".tooltip-arrow").node(),
        },
      }, ],
    });
    this.tooltip.style("display", "block");
  }

  update(source) {

    const treeData = this.treeLayout(this.root);

    const nodes = treeData.descendants();
    const links = treeData.links();

    nodes.forEach(d => {
      d.y = d.depth * 120;
    });
    const link = this.container.selectAll("path.link")
      .data(links, d => d.target.id);

    const node = this.container.selectAll(".node")
      .style("stroke", d => this.strokeColor(d))
      .data(nodes, d => {
        return d.id || (d.id = ++this.i);
      })

    const nodeEnter = node.enter().append("circle")
      .attr('class', 'node')
      .attr("r", 10)
      .style("fill", d => this.fillColor(d))
      .style("stroke", d => this.strokeColor(d))
      .attr("transform", d => `translate(${source.y0},${source.x0})`)
      .on("click", (e, d) => this.toggleNode(e, d))
      .on("mouseover", (e, d) => this.mouseoverHandler(e, d))
      .on("mouseout", (d) => this.tooltip.style("display", "none"))
      .attr('cursor', 'pointer');

    const nodeUpdate = node.merge(nodeEnter).transition()
      .duration(this.duration)
      .attr("transform", d => `translate(${d.y},${d.x})`);

    const nodeExit = node.exit().transition()
      .duration(this.duration)
      .attr("transform", d => `translate(${source.y},${source.x})`)
      .remove();

    nodeExit.select("circle")
      .attr("r", 1e-6);

    const linkEnter = link.enter().insert("path")
      .attr("class", "link")
      .attr("d", d => {
        const o = {
          x: source.x0,
          y: source.y0
        };
        return this.diagonal(o, o);
      });

    linkEnter.merge(link).transition()
      .duration(this.duration)
      .attr("d", d => this.diagonal(d.source, d.target));

    link.exit().transition()
      .duration(this.duration)
      .attr("d", d => {
        const o = {
          x: source.x,
          y: source.y
        };
        return this.diagonal(o, o);
      })
      .remove();

    nodes.forEach(d => {
      d.x0 = d.x;
      d.y0 = d.y;
    });
  }
}