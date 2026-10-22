import ast
import importlib.util
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location("cart_inventory",Path(__file__).with_name("mongoose_cart_inventory.py"))
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class CartInventoryTests(unittest.TestCase):
    def payload(self):
        paths=[
            ("cart_c13b0_python.py",520),
            ("carts/cart_014_marketplace.sh",251),
            ("carts/subteam/cart_1000_agent.py",1200),
            ("research/cart_bad.py",10),
            ("tokens/cart_secret.sh",18),
            ("carts/../cart_evil.py",20),
            ("carts/cart_extremely_large.py",200000),
            ("carts/install.sh",25),
            ("carts/cart_014_marketplace.sh",251),
            ("carts/cart_zzz.exe",12),
            ("cart_in_dir/cart_stuff.py",12),
        ]
        return {"truncated":False,"tree":[{"path":p,"size":n,"type":"blob"} for p,n in paths]}

    def test_inventory_only_carts_excludes_tokens_research_and_large(self):
        result=module.inventory_tree(self.payload())
        self.assertEqual(result["cartCount"],3)
        self.assertEqual([x["kind"] for x in result["carts"]],["python","shell","python"])
        self.assertTrue(all(x["status"]=="discovered_not_executed" for x in result["carts"]))
        self.assertFalse(result["sourceVerified"])
        self.assertFalse(result["executionVerified"])

    def test_no_path_traversal_or_absolute_files(self):
        for name in ["../cart_.py","/cart_x.sh","carts//cart_x.py","carts/./cart_x.py",
                     "secrets/cart_1.py","research/cart_2.py","carts/sub/../cart_3.py"]:
            self.assertIsNone(module.classify(name),name)

    def test_reject_truncated_or_unbounded_tree(self):
        with self.assertRaises(ValueError):
            module.inventory_tree({"tree":[],"truncated":True})
        with self.assertRaises(ValueError):
            module.inventory_tree({"tree":[{}]*25001})
        with self.assertRaises(ValueError):
            module.inventory_tree({"oops":[]})

    def test_python_syntax_only_never_executes(self):
        code="raise RuntimeError('must not run')\n"
        self.assertEqual(module.syntax_check_python(code),{"syntaxValid":True,"executed":False})
        with self.assertRaises(SyntaxError):
            module.syntax_check_python("def broken(:\n")
        with self.assertRaises(ValueError):
            module.syntax_check_python("x"*125001)

if __name__=="__main__":
    unittest.main()
