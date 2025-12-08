import Breadcrumb from "../Breadcrumb";

export default function BreadcrumbExample() {
  return (
    <Breadcrumb
      items={[
        { label: "Dashboard", href: "/" },
        { label: "Post Details" },
      ]}
    />
  );
}
