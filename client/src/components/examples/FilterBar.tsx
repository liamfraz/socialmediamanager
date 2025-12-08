import FilterBar from "../FilterBar";

export default function FilterBarExample() {
  return (
    <FilterBar
      counts={{ all: 12, pending: 5, approved: 4, rejected: 3 }}
      onStatusChange={(s) => console.log("Status:", s)}
    />
  );
}
