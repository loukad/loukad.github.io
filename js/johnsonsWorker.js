
self.onmessage = function(event) {
  const graph = event.data.graph;
  const startVertex = event.data.startVertex; // Get the starting vertex
  const numVertices = Object.keys(graph).length;
  let iteration = 0;

  // Helper to initialize distances and paths for Dijkstra's and Bellman-Ford
  const initialize = (graph, source) => {
    const dist = {};
    const prev = {};
    for (const v in graph) {
      dist[v] = Infinity;
      prev[v] = null;
    }
    dist[source] = 0;
    return { dist, prev };
  };

  // Bellman-Ford algorithm
  const bellmanFord = (graph, source) => {
    const { dist } = initialize(graph, source);
    for (let i = 0; i < numVertices - 1; i++) {
      for (const u in graph) {
        for (const v of graph[u]) {
          if (dist[u] !== Infinity && dist[u] + 1 < dist[v]) {
            dist[v] = dist[u] + 1;
          }
        }
      }
    }
    return dist;
  };

  // Dijkstra's algorithm with path tracking
  const dijkstra = (graph, source) => {
    const { dist, prev } = initialize(graph, source);
    const visited = new Set();
    const pq = new MinPriorityQueue({ priority: x => dist[x] });

    pq.enqueue(source);

    while (!pq.isEmpty()) {
      const u = pq.dequeue().element;
      visited.add(u);

      for (const v of graph[u]) {
        if (!visited.has(v)) {
          const alt = dist[u] + 1;
          if (alt < dist[v]) {
            dist[v] = alt;
            prev[v] = u;
            pq.enqueue(v);
          }
        }
      }
    }
    return { dist, prev };
  };

  // Johnson's algorithm
  const johnsonsAlgorithm = (graph) => {
    const newVertex = Symbol("newVertex");
    graph[newVertex] = [];

    for (const v in graph) {
      graph[newVertex].push(v);
    }

    const h = bellmanFord(graph, newVertex);
    delete graph[newVertex];

    const allPairsDist = {};
    let totalIterations = numVertices ** 2;

    for (const u in graph) {
      const { dist, prev } = dijkstra(graph, u);
      allPairsDist[u] = { dist, prev };
      iteration++;
      const progress = (iteration / totalIterations) * 100;
      self.postMessage({ progress: progress });
    }

    return allPairsDist;
  };

  // Find odd-degree vertices
  const findOddDegreeVertices = (graph) => {
    const oddVertices = [];
    for (const v in graph) {
      if (graph[v].length % 2 !== 0) {
        oddVertices.push(v);
      }
    }
    return oddVertices;
  };

  // Find all pairs of odd-degree vertices and compute their shortest paths
  const findShortestPathBetweenOddVertices = (oddVertices, allPairsDist) => {
    const pairs = [];
    for (let i = 0; i < oddVertices.length; i++) {
      for (let j = i + 1; j < oddVertices.length; j++) {
        const u = oddVertices[i];
        const v = oddVertices[j];
        pairs.push([u, v, reconstructPath(u, v, allPairsDist[u].prev)]);
      }
    }
    return pairs;
  };

  // Reconstruct the path from source to destination
  const reconstructPath = (source, dest, prev) => {
    const path = [];
    for (let at = dest; at !== null; at = prev[at]) {
      path.push(at);
    }
    return path.reverse();
  };

  // Minimum-cost matching for odd vertices
  const minimumCostMatching = (oddVertices, allPairsDist) => {
    const pairs = findShortestPathBetweenOddVertices(oddVertices, allPairsDist);
    const matchedPairs = []; // Implement a suitable matching algorithm here.
    // For simplicity, we will take the first pair (you should replace this with a proper matching algorithm)
    while (pairs.length > 0) {
      matchedPairs.push(pairs.shift().slice(0, 2));
    }
    return matchedPairs;
  };

  // Add matched edges to the graph to make it Eulerian
  const addMatchedEdges = (graph, matchedPairs) => {
    matchedPairs.forEach(([u, v]) => {
      const path = reconstructPath(u, v, allPairsDist[u].prev);
      for (let i = 0; i < path.length - 1; i++) {
        graph[path[i]].push(path[i + 1]);
        graph[path[i + 1]].push(path[i]);
      }
    });
  };

  // Hierholzer’s Algorithm to find Eulerian Tour
  const findEulerianTour = (graph) => {
    const stack = [];
    const tour = [];
    const currentPath = [Object.keys(graph)[0]];

    while (currentPath.length > 0) {
      const v = currentPath[currentPath.length - 1];

      if (graph[v].length > 0) {
        const nextVertex = graph[v].pop();
        graph[nextVertex] = graph[nextVertex].filter(x => x !== v); // Remove reverse edge
        currentPath.push(nextVertex);
      } else {
        tour.push(currentPath.pop());
      }
    }

    return tour.reverse(); // Reverse to get the tour
  };

  // Full Chinese Postman Solver
  const solveChinesePostman = (graph, allPairsDist) => {
    const oddVertices = findOddDegreeVertices(graph);
    if (oddVertices.length === 0) {
      return findEulerianTour(graph);
    }

    const matchedPairs = minimumCostMatching(oddVertices, allPairsDist);
    addMatchedEdges(graph, matchedPairs);
    const eulerianTour = findEulerianTour(graph);

    return eulerianTour;
  };

  // Start Johnson's Algorithm
  const allPairsDist = johnsonsAlgorithm(graph);
  const result = solveChinesePostman(graph, allPairsDist);
  
  // Return the result (Eulerian Tour) to the main thread
  self.postMessage({ result: result });
};
