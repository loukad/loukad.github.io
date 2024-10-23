// MinPriorityQueue implementation for Dijkstra's algorithm
class MinPriorityQueue {
  constructor(options) {
    this.queue = [];
    this.inQueue = new Set();  // Track elements already in the queue
    this.priority = options.priority;
  }

  enqueue(element) {
    this.queue.push(element);
    this.inQueue.add(element);
  }

  dequeue() {
    this.queue.sort((a, b) => this.priority(a) - this.priority(b));
    const element = this.queue.shift();
    this.inQueue.delete(element);
    return element;
  }

  has(element) {
    return this.inQueue.has(element);
  }

  hasItems() {
    return this.queue.length > 0;
  }
}

self.onmessage = function(event) {
  const graph = event.data.graph;
  const dists = event.data.dists;
  const startVertex = event.data.startVertex;
  const numVertices = Object.keys(graph).length;
  let iteration = 0;

  // Create a deep copy of the graph to avoid modifying the original
  function cloneGraph(graph) {
    const newGraph = {};
    for (const vertex in graph) {
      newGraph[vertex] = [...graph[vertex]];
    }
    return newGraph;
  }

  function initialize(graph, source) {
    const dist = {};
    const prev = {};
    for (const v in graph) {
      dist[v] = Infinity;
      prev[v] = null;
    }
    dist[source] = 0;
    return { dist, prev };
  }

  function dijkstra(graph, dists, source) {
    const { dist, prev } = initialize(graph, source);
    const visited = new Set();
    const pq = new MinPriorityQueue({ priority: x => dist[x] });

    pq.enqueue(source);

    while (pq.hasItems()) {
      const u = pq.dequeue();
      visited.add(u);

      for (const v of graph[u]) {
        if (!visited.has(v)) {
          const edgeKey = `${u}-${v}`;
          if (!(edgeKey in dists)) {
            self.postMessage({ error: `Missing distance for edge ${edgeKey}` });
            continue;
          }
          const alt = dist[u] + dists[edgeKey];
          if (alt < dist[v]) {
            dist[v] = alt;
            prev[v] = u;
            if (!pq.has(v)) {
              pq.enqueue(v);
            }
          }
        }
      }
    }
    return { dist, prev };
  }

  function dijkstraForAll(graph, dists) {
    const allPairsDist = {};
    for (const u in graph) {
      const { dist, prev } = dijkstra(graph, dists, u);
      allPairsDist[u] = { dist, prev };
      iteration++;
      self.postMessage({ progress: (iteration / numVertices) * 100 });
    }
    return allPairsDist;
  }

  function findOddDegreeVertices(graph) {
    return Object.entries(graph)
      .filter(([_, edges]) => edges.length % 2 !== 0)
      .map(([vertex]) => vertex);
  }

  // Reconstruct the path ensuring each step is a valid edge
  function reconstructPath(dest, prev, graph) {
    const path = [];
    let at = dest;

    while (at !== null) {
      path.unshift(at);
      const nextAt = prev[at];

      // Verify each step in the path exists in the graph
      if (nextAt !== null && !graph[at].includes(nextAt)) {
        self.postMessage({ error: `Invalid edge in path: ${at}-${nextAt}` });
        return null;
      }
      at = nextAt;
    }
    return path;
  }

  function addMatchedEdges(graph, matchedPairs, allPairsDist) {
    // Keep track of all edges we need to add for each matching
    const edgesToAdd = [];  // Switch to array of [v1, v2] pairs to preserve original order

    matchedPairs.forEach(([u, v]) => {
      const path = reconstructPath(v, allPairsDist[u].prev, graph);
      if (!path) return;

      // self.postMessage({ matchedPath: path });

      // Add edges for each step in the path
      for (let i = 0; i < path.length - 1; i++) {
        const v1 = path[i];
        const v2 = path[i + 1];

        // Store the vertices in their original order
        edgesToAdd.push([v1, v2]);
      }
    });

    // Now add all the required edges to the graph
    for (const [v1, v2] of edgesToAdd) {
      // Verify vertices exist before adding edges
      if (!(v1 in graph) || !(v2 in graph)) {
        self.postMessage({ error: `Invalid vertex in edge ${v1}-${v2}` });
        continue;
      }

      // Add edges in both directions to maintain graph properties
      graph[v1].push(v2);
      graph[v2].push(v1);
    }
  }

  // Finds an Eulerian tour in an undirected graph using Hierholzer's algorithm.
  // An Eulerian tour is a path that uses every edge in the graph exactly once and
  // returns to the starting vertex.
  function findEulerianTour(graph, startVertex) {
    // Make a copy of the graph since we'll be modifying it
    const workingGraph = cloneGraph(graph);
    const tour = [];
    const currentPath = [startVertex];

    // Track available edges for each vertex pair
    const edgeCount = new Map();

    // Initialize edge counts from working graph
    for (const [v, neighbors] of Object.entries(workingGraph)) {
      for (const neighbor of neighbors) {
        const edgeKey = [v, neighbor].sort().join('-');
        edgeCount.set(edgeKey, (edgeCount.get(edgeKey) || 0) + 1);
      }
    }

    while (currentPath.length > 0) {
      const v = currentPath[currentPath.length - 1];

      if (workingGraph[v].length > 0) {
        // Find a valid neighbor that still has available edges
        let neighborIndex = -1;
        for (let i = 0; i < workingGraph[v].length; i++) {
          const neighbor = workingGraph[v][i];
          const edgeKey = [v, neighbor].sort().join('-');
          if (edgeCount.get(edgeKey) > 0) {
            neighborIndex = i;
            break;
          }
        }

        if (neighborIndex >= 0) {
          const nextVertex = workingGraph[v][neighborIndex];
          // Use this edge
          const edgeKey = [v, nextVertex].sort().join('-');
          edgeCount.set(edgeKey, edgeCount.get(edgeKey) - 1);

          // Remove the used edge from working graph
          workingGraph[v].splice(neighborIndex, 1);
          const reverseIndex = workingGraph[nextVertex].indexOf(v);
          workingGraph[nextVertex].splice(reverseIndex, 1);

          currentPath.push(nextVertex);
        } else {
          // No valid edges left from this vertex
          tour.push(currentPath.pop());
        }
      } else {
        tour.push(currentPath.pop());
      }
    }

    return tour.reverse();
  }

  function minimumCostMatching(oddVertices, allPairsDist, graph) {
    const pairs = [];
    for (let i = 0; i < oddVertices.length; i++) {
      for (let j = i + 1; j < oddVertices.length; j++) {
        const u = oddVertices[i];
        const v = oddVertices[j];
        // Verify there exists a valid path between vertices
        const path = reconstructPath(v, allPairsDist[u].prev, graph);
        if (path) {
          pairs.push([u, v, allPairsDist[u].dist[v]]);
        }
      }
    }

    // Sort by actual path cost
    pairs.sort((a, b) => a[2] - b[2]);

    const matchedPairs = [];
    const used = new Set();

    for (const [u, v] of pairs) {
      if (!used.has(u) && !used.has(v)) {
        matchedPairs.push([u, v]);
        used.add(u);
        used.add(v);
        if (matchedPairs.length === oddVertices.length / 2) break;
      }
    }

    return matchedPairs;
  }

  function solveChinesePostman(graph, startVertex) {
    const workingGraph = cloneGraph(graph);
    self.postMessage({message: `CP vertex: ${startVertex}`});

    const oddVertices = findOddDegreeVertices(workingGraph);
    self.postMessage({message: `Odd degree vertices: (${oddVertices.length}) ${oddVertices}`});

    if (oddVertices.length === 0) {
      return findEulerianTour(workingGraph, startVertex);
    }

    self.postMessage({message: 'Running minimum cost matching between odd vertices...'});
    const matchedPairs = minimumCostMatching(oddVertices, allPairsDist, workingGraph);

    addMatchedEdges(workingGraph, matchedPairs, allPairsDist);
    return findEulerianTour(workingGraph, startVertex);
  }

  self.postMessage({message: 'Computing shortest paths...'});
  const allPairsDist = dijkstraForAll(graph, dists);

  const result = solveChinesePostman(graph, startVertex);
  self.postMessage({ result });
};