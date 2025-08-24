// utils/parser.js
export function parseStowageData(jsonData) {
  return {
    vesselInfo: {
      id: jsonData.vesselId,
      capacity: jsonData.vesselCapacity
    },
    bayDetails: jsonData.bayDetails.map(bay => ({
      ...bay,
      rows: bay.rows.map(row => ({
        ...row,
        slots: Array(row.maxTiers).fill(null).map((_, i) => ({
          tier: i + 1,
          container: null
        }))
      }))
    })),
    assignments: jsonData.assignment,
    metrics: {
      cost: jsonData.cost,
      totalReStows: jsonData.totalReStows,
      totalMoves: jsonData.totalMoves
    }
  };
}